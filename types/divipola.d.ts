declare module "divipola" {
  interface DivipolaEntry {
    mpioCode: string;
    mpioName: string;
    deptoName: string;
  }

  const divipola: DivipolaEntry[];
  export default divipola;
}
