"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession, requireAdminSession } from "@/lib/auth/session-guards";
import { NotificationService } from "@/lib/notifications";
import { computeExpectedTotals } from "./reconciliation";

const blindCountSchema = z.object({
  orgSlug: z.string().min(1),
  shiftId: z.string().min(1),
  countedCash: z.coerce.number().int().min(0),
});

// negocio.md §4: el empleado ingresa el efectivo físico que cuenta ANTES de ver el reporte del
// sistema. Este server action recibe ese conteo y solo entonces calcula/compara el total esperado.
export async function submitBlindCount(formData: FormData): Promise<void> {
  const parsed = blindCountSchema.safeParse({
    orgSlug: formData.get("orgSlug"),
    shiftId: formData.get("shiftId"),
    countedCash: formData.get("countedCash"),
  });
  if (!parsed.success) {
    notFound();
  }

  await requireStaffSession(parsed.data.orgSlug);

  const shift = await db.cashShift.findUnique({ where: { id: parsed.data.shiftId } });
  if (!shift || shift.status !== "ABIERTO") {
    notFound();
  }

  const totals = await computeExpectedTotals(shift.orgId, shift.openedAt);
  const expectedCash = shift.openingCash + totals.cash;
  const discrepancy = parsed.data.countedCash - expectedCash;

  if (discrepancy === 0) {
    await db.cashShift.update({
      where: { id: shift.id },
      data: {
        status: "CERRADO",
        closedAt: new Date(),
        expectedCourtsTotal: totals.courtsTotal,
        expectedBarTotal: totals.barTotal,
        expectedCash,
        expectedTransfer: totals.transfer,
        expectedCard: totals.card,
        countedCash: parsed.data.countedCash,
        discrepancy: 0,
        resolvedAt: new Date(),
      },
    });
  } else {
    await db.cashShift.update({
      where: { id: shift.id },
      data: {
        status: "EN_DISPUTA",
        closedAt: new Date(),
        expectedCourtsTotal: totals.courtsTotal,
        expectedBarTotal: totals.barTotal,
        expectedCash,
        expectedTransfer: totals.transfer,
        expectedCard: totals.card,
        countedCash: parsed.data.countedCash,
        discrepancy,
      },
    });

    const admin = await db.user.findFirst({ where: { orgId: shift.orgId, role: "ADMIN" } });
    if (admin) {
      await NotificationService.sendCashMismatchAlert({
        adminEmail: admin.email,
        shiftId: shift.id,
        expectedTotal: expectedCash,
        countedTotal: parsed.data.countedCash,
        discrepancy,
      });
    }
  }

  redirect(`/${parsed.data.orgSlug}/pos/cierre/${shift.id}`);
}

const shiftIdSchema = z.object({
  shiftId: z.string().min(1),
});

const adjustSchema = shiftIdSchema.extend({
  newCountedCash: z.coerce.number().int().min(0),
  reason: z.string().trim().min(5),
});

// negocio.md §6.5: solo el ADMIN reabre y ajusta, con motivo obligatorio; queda un registro de
// auditoría inmutable (se agrega una entrada nueva, nunca se sobrescribe una anterior).
export async function adjustCashShift(formData: FormData): Promise<void> {
  const parsed = adjustSchema.safeParse({
    shiftId: formData.get("shiftId"),
    newCountedCash: formData.get("newCountedCash"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    notFound();
  }

  const { session } = await requireAdminSession();

  const shift = await db.cashShift.findUnique({ where: { id: parsed.data.shiftId } });
  if (!shift || shift.status !== "EN_DISPUTA" || shift.expectedCash === null) {
    notFound();
  }

  const newDiscrepancy = parsed.data.newCountedCash - shift.expectedCash;

  await db.cashShift.update({
    where: { id: shift.id },
    data: {
      countedCash: parsed.data.newCountedCash,
      discrepancy: newDiscrepancy,
      adjustments: {
        push: {
          previousCountedCash: shift.countedCash ?? 0,
          newCountedCash: parsed.data.newCountedCash,
          reason: parsed.data.reason,
          adjustedByName: session.user.name,
          adjustedAt: new Date(),
        },
      },
    },
  });

  redirect(`/admin/caja/${shift.id}`);
}

export async function resolveDispute(formData: FormData): Promise<void> {
  const parsed = shiftIdSchema.safeParse({
    shiftId: formData.get("shiftId"),
  });
  if (!parsed.success) {
    notFound();
  }

  const { session } = await requireAdminSession();

  const shift = await db.cashShift.findUnique({ where: { id: parsed.data.shiftId } });
  if (!shift || shift.status !== "EN_DISPUTA") {
    notFound();
  }

  await db.cashShift.update({
    where: { id: shift.id },
    data: {
      status: "CERRADO",
      resolvedAt: new Date(),
      resolvedByName: session.user.name,
    },
  });

  redirect("/admin/caja");
}
