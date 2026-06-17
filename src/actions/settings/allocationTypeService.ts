"use server";

import axios from "@/lib/axios-auth";

const BASE = "AllocationTypes";

const getAllocationTypes = async () => {
  try {
    const res = await axios.get(`${process.env.BACK_END}/${BASE}/getAll`, {
      headers: {
        "Content-Type": "application/json",
        withCredentials: true,
      },
    });
    return res.data;
  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string } }; message?: string };
    return { error: "Request Failed", message: err.response?.data?.message || err.message || "An unexpected error occurred" };
  }
};

export { getAllocationTypes };
