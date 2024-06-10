import { isFunction, isGeneratorFunction } from 'is-type-of';
import { MiddlewareFunc } from './types.js';

type Fn = (...args: any[]) => any;

export async function callFn(fn: Fn, args: any[], ctx: unknown) {
  args = args || [];
  if (!isFunction(fn)) {
    return;
  }
  if (isGeneratorFunction(fn)) {
    throw new TypeError(`Please use async function instead of generator function: ${fn.toString()}`);
  }
  return ctx ? fn.call(ctx, ...args) : fn(...args);
}

export function middleware(fn: MiddlewareFunc) {
  if (isGeneratorFunction(fn)) {
    throw new TypeError(`Please use async function instead of generator function: ${fn.toString()}`);
  }
  return fn;
}
