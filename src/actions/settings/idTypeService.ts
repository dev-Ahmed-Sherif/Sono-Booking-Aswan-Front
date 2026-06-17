"use server";

import axios from "@/lib/axios-auth";

const getIdTypes = async () => {
  try {
    const res = await axios.get(`${process.env.BACK_END}/IDTypes/getAll`, {
      headers: {
        "Content-Type": "application/json",
        withCredentials: true,
      },
    });

    return res.data;
  } catch (error: unknown) {
    console.error("Error getting id types:", error);

    const err = error as {
      response?: { status?: number; data?: { message?: string } };
      message?: string;
    };
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          err.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }

    return {
      error: "Failed to get id types",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

export { getIdTypes };
