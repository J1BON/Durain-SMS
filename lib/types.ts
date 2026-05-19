export type Service = {
  pid: number;
  name: string;
  /** Credit cost per SMS (from panel project list). */
  cost?: number;
  /** API serial mode: 1 = multiple messages, 2 = single (Durian default). */
  serial?: number;
};
