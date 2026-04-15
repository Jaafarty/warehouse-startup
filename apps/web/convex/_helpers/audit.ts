import { DatabaseWriter } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export async function createAuditLog(
  db: DatabaseWriter,
  params: {
    storeId: Id<"stores">;
    userId: Id<"users">;
    action: string;
    entityType: string;
    entityId: string;
    details?: any;
  }
) {
  await db.insert("auditLogs", {
    ...params,
    timestamp: Date.now(),
  });
}
