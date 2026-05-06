import { DatabaseWriter } from "../_generated/server";
import { Doc } from "../_generated/dataModel";

export async function createAuditLog(
  db: DatabaseWriter,
  params: Omit<Doc<"auditLogs">, "_id" | "_creationTime" | "timestamp">
) {
  await db.insert("auditLogs", {
    ...params,
    timestamp: Date.now(),
  });
}
