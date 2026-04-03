"use client";

import type { AppLanguage } from "./types";
import { persistAdminLanguage } from "./resources";
import adminI18n from "./client";

export async function setAdminLanguage(code: AppLanguage): Promise<void> {
  await persistAdminLanguage(code);
  await adminI18n.changeLanguage(code);
}
