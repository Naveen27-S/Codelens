// Browser shim for Node.js 'util' module needed by printf
export function inspect(obj: any, ..._args: any[]): string {
  if (typeof obj === 'string') return obj;
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

export default {
  inspect,
};
