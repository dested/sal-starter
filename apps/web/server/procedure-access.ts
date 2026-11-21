// Who may call a procedure, by the tag its builder sets (server/trpc.ts), per
// caller: the columns of the access table (server/router.access.md, written by
// `bun run access:table`). A new builder gets a tag here; server/trpc.api.test.ts
// proves each tag's row against what the builders actually do. Pure, so the
// table script reads it without an environment.
export const ACCESS = {
  public: { 'signed out': true, 'signed in': true, admin: true },
  user: { 'signed out': false, 'signed in': true, admin: true },
  admin: { 'signed out': false, 'signed in': false, admin: true },
} as const satisfies Record<string, Record<string, boolean>>

export type Access = keyof typeof ACCESS
