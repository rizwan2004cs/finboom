import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { sipExpenseDescription } from "@/lib/finance/sip-payments"

/** Mark a SIP paid for a month — creates investment expense + sip_payment row. */
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const sipId = body.sipId as string | undefined
  const monthKey = body.monthKey as string | undefined
  const paidDate = (body.paidDate as string | undefined) ?? new Date().toISOString().slice(0, 10)

  if (!sipId || !monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    return NextResponse.json({ error: "Invalid sipId or monthKey" }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: sip, error: sipError } = await supabase
    .from("sips")
    .select("*")
    .eq("id", sipId)
    .eq("user_id", userId)
    .maybeSingle()

  if (sipError) {
    return NextResponse.json({ error: sipError.message }, { status: 500 })
  }
  if (!sip) {
    return NextResponse.json({ error: "SIP not found" }, { status: 404 })
  }

  const { data: existing } = await supabase
    .from("sip_payments")
    .select("id")
    .eq("sip_id", sipId)
    .eq("month", monthKey)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: "Already marked paid for this month" }, { status: 409 })
  }

  const amount = Number(sip.amount)

  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      profile_id: sip.profile_id,
      type: "expense",
      category: "investment",
      amount,
      description: sipExpenseDescription(sip),
      date: paidDate,
      currency: sip.currency || "INR",
    })
    .select()
    .single()

  if (txError || !tx) {
    return NextResponse.json({ error: txError?.message ?? "Could not create expense" }, { status: 500 })
  }

  const { data: payment, error: payError } = await supabase
    .from("sip_payments")
    .insert({
      user_id: userId,
      sip_id: sipId,
      month: monthKey,
      paid_date: paidDate,
      amount,
      transaction_id: tx.id,
    })
    .select()
    .single()

  if (payError || !payment) {
    await supabase.from("transactions").delete().eq("id", tx.id).eq("user_id", userId)
    return NextResponse.json({ error: payError?.message ?? "Could not save SIP payment" }, { status: 500 })
  }

  return NextResponse.json({ transaction: tx, payment })
}

/** Unmark a SIP payment — removes linked expense too. */
export async function DELETE(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const paymentId = body.paymentId as string | undefined
  if (!paymentId) {
    return NextResponse.json({ error: "Missing paymentId" }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: payment, error: loadError } = await supabase
    .from("sip_payments")
    .select("*")
    .eq("id", paymentId)
    .eq("user_id", userId)
    .maybeSingle()

  if (loadError) {
    return NextResponse.json({ error: loadError.message }, { status: 500 })
  }
  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 })
  }

  if (payment.transaction_id) {
    await supabase
      .from("transactions")
      .delete()
      .eq("id", payment.transaction_id)
      .eq("user_id", userId)
  }

  const { error: delError } = await supabase
    .from("sip_payments")
    .delete()
    .eq("id", paymentId)
    .eq("user_id", userId)

  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
