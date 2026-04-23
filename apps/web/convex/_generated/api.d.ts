/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _helpers_audit from "../_helpers/audit.js";
import type * as _helpers_permissions from "../_helpers/permissions.js";
import type * as _helpers_stock from "../_helpers/stock.js";
import type * as analytics from "../analytics.js";
import type * as categories from "../categories.js";
import type * as email from "../email.js";
import type * as invitations from "../invitations.js";
import type * as members from "../members.js";
import type * as notifications from "../notifications.js";
import type * as products from "../products.js";
import type * as sales from "../sales.js";
import type * as stockMovements from "../stockMovements.js";
import type * as stores from "../stores.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_helpers/audit": typeof _helpers_audit;
  "_helpers/permissions": typeof _helpers_permissions;
  "_helpers/stock": typeof _helpers_stock;
  analytics: typeof analytics;
  categories: typeof categories;
  email: typeof email;
  invitations: typeof invitations;
  members: typeof members;
  notifications: typeof notifications;
  products: typeof products;
  sales: typeof sales;
  stockMovements: typeof stockMovements;
  stores: typeof stores;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
