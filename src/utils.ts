import { isFunction, isGeneratorFunction } from 'is-type-of';

export async function callFn(fn: Function, args: any[], ctx: unknown): Promise<unknown> {
  args = args || [];
  if (!isFunction(fn)) {
    return;
  }
  if (isGeneratorFunction(fn)) {
    throw new TypeError(`Please use async function instead of generator function: ${fn.toString()}`);
  }
  return ctx ? fn.call(ctx, ...args) : fn(...args);
}

export function middleware(fn: Function) {
  if (isGeneratorFunction(fn)) {
    throw new TypeError(`Please use async function instead of generator function: ${fn.toString()}`);
  }
  return fn;
}
