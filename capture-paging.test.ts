import { describe, expect, it } from "vitest";
import { captureThread } from "./capture";

const SERVER_EVENT_LIMIT = 100;

function fakeBb(totalEvents: number) {
  const events = Array.from({ length: totalEvents }, (_, i) => ({
    seq: i + 1,
    type: "item/completed",
    data: { item: { type: "agentMessage", id: `m${i + 1}`, text: `message ${i + 1}` } },
  }));
  const requestedLimits: number[] = [];
  const bb = {
    sdk: {
      threads: {
        get: async () => ({ environmentId: null, providerId: "codex", title: "t", projectId: "p" }),
        output: async () => ({ output: "done" }),
        events: {
          list: async ({ afterSeq, limit }: { afterSeq?: string; limit: string }) => {
            const size = Number(limit);
            requestedLimits.push(size);
            if (size > SERVER_EVENT_LIMIT) {
              throw new Error(`HTTP 400: Thread event limit cannot exceed ${SERVER_EVENT_LIMIT}`);
            }
            const after = afterSeq ? Number(afterSeq) : 0;
            return events.filter((e) => e.seq > after).slice(0, size);
          },
        },
      },
      environments: { get: async () => { throw new Error("no environment"); } },
      files: { list: async () => ({ entries: [] }) },
    },
  };
  return { bb, requestedLimits };
}

describe("captureThread paging", () => {
  it("reads every event of a long thread within the server's page limit", async () => {
    const { bb, requestedLimits } = fakeBb(265);
    // deno-lint-ignore no-explicit-any
    const session = await captureThread(bb as any, "thr_long");
    expect(session.eventCount).toBe(265);
    expect(requestedLimits.length).toBe(3);
    expect(Math.max(...requestedLimits)).toBeLessThanOrEqual(SERVER_EVENT_LIMIT);
  });
});
