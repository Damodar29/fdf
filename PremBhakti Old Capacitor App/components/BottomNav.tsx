/**
 * BottomNav — compatibility shim.
 *
 * The bottom navigation was rebuilt for the Janmashtami theme in
 * `JanmashtamiBottomNav.tsx`. This file preserves the original import path and
 * export name so `App.tsx` (which imports `{ BottomNav }` from here) needs no
 * change and the prop contract is unchanged. See `JanmashtamiBottomNav.tsx` for
 * the implementation and the rationale behind the redesign.
 */
export {
	default,
	JanmashtamiBottomNav as BottomNav,
} from "./JanmashtamiBottomNav";
