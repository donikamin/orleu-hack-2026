/** QR хранит время с точностью до минуты, поэтому одно задание не может дважды попасть в одну минуту. */
export function uniqueMinuteTs(now: number, prev: number | undefined): number {
  if (prev === undefined || Math.floor(now / 60) > Math.floor(prev / 60)) return now;
  return (Math.floor(prev / 60) + 1) * 60;
}

export const floorMinute = (ts: number) => Math.floor(ts / 60) * 60;
