import type { Role, ModulePermissions } from "../constants";

export interface StoreMember {
  id: string;
  storeId: string;
  userId: string;
  role: Role;
  permissions: ModulePermissions;
  joinedAt: number;
}
