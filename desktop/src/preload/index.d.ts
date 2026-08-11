import type { OgtApi } from "../shared/types";

declare global {
  interface Window {
    ogt: OgtApi;
  }
}

export {};
