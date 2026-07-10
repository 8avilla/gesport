import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getTodayBookings } from "@/lib/pos/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ org: string }> },
): Promise<Response> {
  const { org: orgSlug } = await params;

  const session = await auth();
  const isSuperadmin = session?.user?.role === "SUPERADMIN";
  if (!session?.user || (!isSuperadmin && session.user.orgSlug !== orgSlug)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const organization = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    return NextResponse.json({ error: "no encontrado" }, { status: 404 });
  }

  const bookings = await getTodayBookings(organization.id);

  return NextResponse.json({
    bookings: bookings.map((booking) => ({
      id: booking.id,
      status: booking.status,
      startTime: booking.startTime,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      receiptUrl: booking.receiptUrl,
      venueName: booking.venue.name,
    })),
  });
}
