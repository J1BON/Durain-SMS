import { getSupabase } from "./supabase";

export interface TrackingEntry {
  id: string;
  userId: string;
  username: string;
  phoneNumber: string;
  pid: string;
  country: string;
  assignedAt: number;
  receivedSms: boolean;
  released: boolean;
  smsCode?: string;
  updatedAt?: number;
}

export interface UserStats {
  userId: string;
  username: string;
  smsReceived: number;
  numbersReleased: number;
  totalAssigned: number;
}

type DbRow = {
  id: string;
  user_id: string;
  username: string;
  phone_number: string;
  pid: string;
  country: string;
  assigned_at: number;
  received_sms: boolean;
  released: boolean;
  sms_code?: string;
  updated_at?: number;
};

function fromRow(row: DbRow): TrackingEntry {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    phoneNumber: row.phone_number,
    pid: row.pid,
    country: row.country,
    assignedAt: row.assigned_at,
    receivedSms: row.received_sms,
    released: row.released,
    smsCode: row.sms_code,
    updatedAt: row.updated_at,
  };
}

export async function recordNumberAssigned(
  userId: string,
  username: string,
  phoneNumber: string,
  pid: string,
  country: string,
): Promise<void> {
  const sb = getSupabase();
  await sb.from("sms_tracking").insert({
    id: `${userId}_${Date.now()}`,
    user_id: userId,
    username,
    phone_number: phoneNumber,
    pid,
    country,
    assigned_at: Date.now(),
    received_sms: false,
    released: false,
  });
}

export async function recordSmsReceived(
  userId: string,
  phoneNumber: string,
  smsCode: string,
): Promise<void> {
  const sb = getSupabase();
  const { data } = await sb
    .from("sms_tracking")
    .select("id")
    .eq("user_id", userId)
    .eq("phone_number", phoneNumber)
    .eq("received_sms", false)
    .eq("released", false)
    .order("assigned_at", { ascending: false })
    .limit(1);
  if (data?.[0]) {
    await sb
      .from("sms_tracking")
      .update({
        received_sms: true,
        sms_code: smsCode,
        updated_at: Date.now(),
      })
      .eq("id", data[0].id);
  }
}

export async function recordNumberReleased(
  userId: string,
  phoneNumber: string,
): Promise<void> {
  const sb = getSupabase();
  const { data } = await sb
    .from("sms_tracking")
    .select("id")
    .eq("user_id", userId)
    .eq("phone_number", phoneNumber)
    .eq("received_sms", false)
    .eq("released", false)
    .order("assigned_at", { ascending: false })
    .limit(1);
  if (data?.[0]) {
    await sb
      .from("sms_tracking")
      .update({
        released: true,
        updated_at: Date.now(),
      })
      .eq("id", data[0].id);
  }
}

export async function getAllUsersStats(
  userList: { id: string; username: string }[],
): Promise<UserStats[]> {
  const sb = getSupabase();
  const { data } = await sb
    .from("sms_tracking")
    .select("user_id, received_sms, released");
  const rows = data ?? [];
  return userList.map((u) => {
    const mine = rows.filter((r) => r.user_id === u.id);
    return {
      userId: u.id,
      username: u.username,
      smsReceived: mine.filter((r) => r.received_sms).length,
      numbersReleased: mine.filter((r) => r.released && !r.received_sms).length,
      totalAssigned: mine.length,
    };
  });
}

export async function getRecentActivity(limit = 100): Promise<TrackingEntry[]> {
  const sb = getSupabase();
  const { data } = await sb
    .from("sms_tracking")
    .select("*")
    .order("assigned_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as DbRow[]).map(fromRow);
}
