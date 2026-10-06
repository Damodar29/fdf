/**
 * Checks utils/usageStats.ts (Admin → Usage) and utils/reviewAlerts.ts.
 * Run: npx tsx scripts/check-usage-stats.ts
 */
import { rejectionAlerts } from "../utils/reviewAlerts";
import {
	addSession,
	addTime,
	dailyTotals,
	dayKey,
	emptyPending,
	formatDuration,
	hourTotals,
	lastDays,
	pendingSeconds,
	userUsage,
} from "../utils/usageStats";

let failed = 0;
const check = (name: string, ok: boolean, got?: unknown) => {
	if (!ok) {
		failed++;
		console.error(`✗ ${name}`, got ?? "");
	} else console.log(`✓ ${name}`);
};

// Day keys
const t = new Date(2026, 9, 1, 7, 30).getTime(); // 1 Oct 2026, 7:30 local
check("dayKey", dayKey(t) === "20261001", dayKey(t));
const days = lastDays(3, t);
check("lastDays", days.join() === "20261001,20260930,20260929", days);

// Pending time on the phone
const p = emptyPending();
addSession(p, t);
addTime(p, 120, t);
addTime(p, 30, t + 3600_000); // 8:30
addTime(p, -5, t); // ignored
check("pending day", p.d["20261001"][0] === 150 && p.d["20261001"][1] === 1, p);
check("pending hours", p.h["7"] === 120 && p.h["8"] === 30, p.h);
check("pendingSeconds", pendingSeconds(p) === 150);

// Admin totals
const docs = {
	a: {
		d: { "20261001": { s: 600, n: 2 }, "20260920": { s: 300, n: 1 } },
		h: { "7": 900 },
		nm: "A",
	},
	b: { d: { "20260930": { s: 60, n: 1 } }, h: { "20": 60 }, nm: "B" },
};
const week = new Set(lastDays(7, t));
const ua = userUsage("a", docs.a, week);
check(
	"userUsage week",
	ua.seconds === 600 && ua.sessions === 2 && ua.activeDays === 1,
	ua,
);
check(
	"userUsage total/lastDay",
	ua.totalSeconds === 900 && ua.lastDay === "20261001",
	ua,
);
check("userUsage all", userUsage("a", docs.a, null).seconds === 900);
const daily = dailyTotals(Object.values(docs), ["20260930", "20261001"]);
check(
	"dailyTotals",
	daily[0].users === 1 && daily[1].users === 1 && daily[1].seconds === 600,
	daily,
);
const hrs = hourTotals(Object.values(docs));
check("hourTotals", hrs[7] === 900 && hrs[20] === 60 && hrs.length === 24);
check("formatDuration", formatDuration(4800, false) === "1h 20m");
check("formatDuration <1", formatDuration(20, true) === "<1 मि");

// Rejection alerts
const base = {
	isApproved: false,
	realName: "Me",
	familyMembers: [
		{ id: "1", realName: "Maa", approvalStatus: "rejected", rejectionNote: "photo" },
		{ id: "2", realName: "Papa" }, // follows the devotee — not listed
		{ id: "3", realName: "Bhai", approvalStatus: "approved" },
	],
} as any;
const r1 = rejectionAlerts({ ...base, rejectionNote: "name wrong" });
check(
	"alerts self + member",
	r1.length === 2 && r1[0].kind === "self" && r1[1].memberId === "1",
	r1,
);
check("alerts member only", rejectionAlerts(base).length === 1);
check(
	"alerts none when approved",
	rejectionAlerts({ ...base, isApproved: true, familyMembers: [] }).length === 0,
);
check(
	"alerts none when deleted",
	rejectionAlerts({ ...base, isDeleted: true }).length === 0,
);

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log("\nAll usage/alert checks passed");
