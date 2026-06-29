"use server";

import axios from "@/lib/axios-auth";
import { getAccessToken } from "@/lib/token-helper";
import { toPlainSerializable } from "@/lib/to-plain-serializable";

type Payload = Record<string, unknown>;
const BASE = "Leaders";

async function request(
  method: "get" | "post" | "put" | "delete",
  url: string,
  data?: unknown,
) {
  const accessToken = await getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const config = {
    headers,
    withCredentials: true,
  };

  try {
    if (method === "get" || method === "delete")
      return toPlainSerializable((await axios[method](url, config)).data);
    return toPlainSerializable((await axios[method](url, data, config)).data);
  } catch (error: unknown) {
    const err = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    return {
      error: "Request Failed",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
}

const getLeaders = async () =>
  request("get", `${process.env.BACK_END}/${BASE}/getAll`);
const getLeaderById = async (id: string) =>
  id === "new" ? null : request("get", `${process.env.BACK_END}/${BASE}/get/${id}`);
const getLeadersPaged = async (filter: Payload) =>
  request("post", `${process.env.BACK_END}/${BASE}/getPaged`, filter);

export { getLeaderById, getLeaders, getLeadersPaged };
