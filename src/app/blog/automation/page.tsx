import Link from "next/link"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { getBlogAutomationStatus } from "@/lib/blog/automation-status"
import { listPendingQueueTopics } from "@/lib/blog/topic-queue"
import { TriggerButton } from "./trigger-button"
import { AddTopicForm, SkipTopicButton } from "./queue-actions"

export const revalidate = 0

export default async function BlogAutomationPage() {
  const { userId } = await auth()
  if (!userId) {
    redirect("/blog")
  }

  const client = await clerkClient()
  const clerkUser = await client.users.getUser(userId)
  const role = (clerkUser.publicMetadata as { role?: string })?.role

  if (role !== "admin" && role !== "editor") {
    redirect("/blog")
  }

  const status = await getBlogAutomationStatus()
  const upcomingTopics = await listPendingQueueTopics(10)

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <header>
        <nav className="sticky top-0 z-50 glass-elevated border-b border-black/[0.04] dark:border-white/[0.06]">
          <div className="max-w-[920px] mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
            <Link href="/blog" className="text-[22px] font-bold tracking-[-0.5px] text-[#1d1d1f] dark:text-white">
              FinBoom
            </Link>
            <Link href="/blog" className="text-[15px] font-medium text-[#1d1d1f] dark:text-white px-3 py-1.5 rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-all duration-200">
              Blog
            </Link>
          </div>
        </nav>
      </header>

      <main className="max-w-[920px] mx-auto px-6 lg:px-10 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-[#1d1d1f] dark:text-white font-serif">
          Blog Automation
        </h1>
        <p className="mt-2 text-sm text-[#6e6e73] dark:text-[#98989d]">
          Daily auto-post queue status and next scheduled topic.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Queue Enabled" value={status.queueEnabled ? "Yes" : "No"} />
          <StatCard label="Pending Topics" value={String(status.pendingCount)} />
          <StatCard label="Posted Topics" value={String(status.postedCount)} />
          <StatCard
            label="Last Auto Post"
            value={
              status.lastAutoPost
                ? new Date(status.lastAutoPost.postedAt).toLocaleString("en-IN", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Not yet"
            }
          />
        </div>

        <section className="mt-8 rounded-2xl border border-black/10 dark:border-white/10 p-5">
          <h2 className="text-lg font-semibold text-[#1d1d1f] dark:text-white">Manual Trigger</h2>
          <p className="mt-1 mb-4 text-sm text-[#6e6e73] dark:text-[#98989d]">
            Run the daily pipeline immediately: picks the next topic, generates the post, publishes
            it, and notifies subscribers. Bypasses the 24-hour limit.
          </p>
          <TriggerButton />
        </section>

        <section className="mt-6 rounded-2xl border border-black/10 dark:border-white/10 p-5">
          <h2 className="text-lg font-semibold text-[#1d1d1f] dark:text-white">Next Topic</h2>
          {status.nextTopic ? (
            <div className="mt-3 space-y-3">
              <p className="text-[#1d1d1f] dark:text-white">{status.nextTopic.title}</p>
              <p className="text-xs text-[#86868b]">
                Source: <code>{status.nextTopic.source}</code>
              </p>
              <SkipTopicButton topicId={status.nextTopic.id} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-[#86868b]">No pending topics in queue.</p>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-black/10 dark:border-white/10 p-5">
          <h2 className="text-lg font-semibold text-[#1d1d1f] dark:text-white">Queue a Topic</h2>
          <p className="mt-1 mb-4 text-sm text-[#6e6e73] dark:text-[#98989d]">
            Add your own topic - it jumps ahead of the seeded list and will be used for the next
            post (scheduled or manual).
          </p>
          <AddTopicForm />
        </section>

        {upcomingTopics.length > 1 && (
          <section className="mt-6 rounded-2xl border border-black/10 dark:border-white/10 p-5">
            <h2 className="text-lg font-semibold text-[#1d1d1f] dark:text-white">Upcoming Topics</h2>
            <p className="mt-1 text-sm text-[#6e6e73] dark:text-[#98989d]">
              The next {upcomingTopics.length} topics in queue order.
            </p>
            <ol className="mt-4 space-y-2">
              {upcomingTopics.map((topic, index) => (
                <li key={topic.id} className="flex items-start gap-3 text-[15px]">
                  <span className="mt-0.5 w-6 shrink-0 text-right text-sm tabular-nums text-[#86868b]">
                    {index + 1}.
                  </span>
                  <span className="text-[#1d1d1f] dark:text-white">{topic.title}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-black/10 dark:border-white/10 p-5">
          <h2 className="text-lg font-semibold text-[#1d1d1f] dark:text-white">Last Auto Post</h2>
          {status.lastAutoPost ? (
            <div className="mt-3 space-y-2">
              <p className="text-[#1d1d1f] dark:text-white">{status.lastAutoPost.title}</p>
              <Link
                href={`/blog/${status.lastAutoPost.slug}`}
                className="inline-flex text-sm text-accent hover:opacity-80"
              >
                Open post
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-sm text-[#86868b]">No automated posts have been published yet.</p>
          )}
        </section>
      </main>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 p-4 bg-white dark:bg-white/5">
      <p className="text-xs text-[#86868b] uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#1d1d1f] dark:text-white">{value}</p>
    </div>
  )
}

