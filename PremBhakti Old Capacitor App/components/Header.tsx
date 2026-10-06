/**
 * Header — compatibility shim.
 *
 * The header was rebuilt for the Janmashtami theme in `JanmashtamiHeader.tsx`.
 * This file preserves the original import path and export name so `App.tsx`
 * (which imports `{ Header }` from here) needs no change, and the prop contract
 * is unchanged. See `JanmashtamiHeader.tsx` for the implementation and the
 * rationale behind the redesign.
 */
export {
	default,
	JanmashtamiHeader as Header,
} from "./JanmashtamiHeader";
