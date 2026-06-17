"use server";

import axios from "@/lib/axios-auth";
import { getAccessToken } from "@/lib/token-helper";
import { toPlainSerializable } from "@/lib/to-plain-serializable";

const BASE = "Dashboard";

const getGovernorDashboardSummary = async () => {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      error: "Unauthorized",
      message: "لم يتم العثور على جلسة الدخول. يرجى تسجيل الدخول.",
    };
  }

  try {
    const res = await axios.get(
      `${process.env.BACK_END}/${BASE}/getGovernorSummary`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        withCredentials: true,
      },
    );
    return toPlainSerializable(res.data);
  } catch (error: unknown) {
    const err = error as {
      response?: { status?: number; data?: { message?: string; Message?: string } };
      message?: string;
    };
    const bodyMessage = String(
      err.response?.data?.message ?? err.response?.data?.Message ?? "",
    ).trim();

    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message: bodyMessage || "يرجى تسجيل الدخول مرة أخرى.",
      };
    }

    return {
      error: "Request Failed",
      message: bodyMessage || err.message || "حدث خطأ غير متوقع",
    };
  }
};

export { getGovernorDashboardSummary };
