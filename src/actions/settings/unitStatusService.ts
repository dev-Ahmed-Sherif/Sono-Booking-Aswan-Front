"use server";

import axios from "axios";
import { getAccessToken } from "@/lib/token-helper";

const BASE = "UnitStatuses";

const getUnitStatuses = async () => {
  const accessToken = await getAccessToken();
  if (!accessToken) return { error: "Unauthorized", message: "No access token found. Please login again." };

  try {
    const res = await axios.get(`${process.env.BACK_END}/${BASE}/getAll`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        withCredentials: true,
      },
    });
    return res.data;
  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string } }; message?: string };
    return { error: "Request Failed", message: err.response?.data?.message || err.message || "An unexpected error occurred" };
  }
};

export { getUnitStatuses };
