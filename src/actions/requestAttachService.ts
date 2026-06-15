"use server";

import axios from "axios";
import { getAccessToken } from "@/lib/token-helper";

const BASE = "RequestAttaches";

async function request(
  method: "get" | "post" | "put" | "delete",
  url: string,
  data?: unknown,
) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      error: "Unauthorized",
      message: "No access token found. Please login again.",
    };
  }

  const config = {
    withCredentials: true,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  };

  try {
    if (method === "delete") {
      const res = await axios.delete(url, {
        ...config,
        ...(data !== undefined ? { data } : {}),
      });
      return res.data;
    }

    const res = await axios[method](url, data, config);
    return res.data;
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
        "An unexpected error occurred.",
    };
  }
}

const softDeleteRequestAttachById = async (id: string) =>
  request(
    "delete",
    `${process.env.BACK_END}/${BASE}/deleteSoft/${encodeURIComponent(id)}`,
  );

const softDeleteRequestAttachesRange = async (ids: string[]) => {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return { data: null };

  const results = await Promise.all(
    uniqueIds.map((id) => softDeleteRequestAttachById(id)),
  );
  const failed = results.find(
    (r) => r && typeof r === "object" && "error" in r && r.error,
  );
  if (failed) return failed;
  return results[results.length - 1];
};

export { softDeleteRequestAttachById, softDeleteRequestAttachesRange };
