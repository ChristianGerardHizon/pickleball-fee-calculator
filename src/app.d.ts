/// <reference types="@cloudflare/workers-types" />

// See https://svelte.dev/docs/kit/types#app.d.ts
// for these interfaces

declare global {
	namespace App {
		interface Locals {
			user: { id: string; email: string } | null;
		}

		interface Platform {
			env: {
				DB: D1Database;
				TURNSTILE_SECRET_KEY?: string;
				PUBLIC_TURNSTILE_SITE_KEY?: string;
			};
			context: {
				waitUntil(promise: Promise<unknown>): void;
			};
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};
