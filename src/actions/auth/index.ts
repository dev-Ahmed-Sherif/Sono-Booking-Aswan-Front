"use server";

import * as z from "zod";
import axios from "axios";
import "@/lib/axios-auth";
import {
  clearAccessToken,
  getAccessToken,
  getRefreshToken,
  getUserId,
  setAccessToken,
} from "@/lib/token-helper";
import { refreshAccessTokenOnce } from "@/lib/refresh-access-token";
import { toPlainSerializable } from "@/lib/to-plain-serializable";
import {
  extractNationalIdCheckResult,
  mapRegisterApiMessage,
} from "@/lib/companion-registration";

import { LoginSchema, ForgotPasswordSchema } from "@/schemas";

type RefreshTokenInput = {
  userId: string;
  accessToken: string;
  refreshToken: string;
};


const Login = async (values: z.infer<typeof LoginSchema>) => {
  //   console.log("name: " + values.name);
  //   console.log("password: " + values.password);
  //  Simulate server-side validation and authentication logic here
  const validatedFields = LoginSchema.safeParse(values);
  //   console.log("Validated fields: " + validatedFields);
  if (!validatedFields.success) {
    return { error: "Invalid Fields!" };
  }
  //   return { error: "test" };
  const res = await axios.post(
    `${process.env.BACK_END}/accounts/login`,
    {
      email: values.email,
      password: values.password,
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  try {
    const root = res.data as Record<string, unknown> | undefined;
    const payload = (root?.data ?? root) as Record<string, unknown> | undefined;
    const token = payload?.accessToken ?? (payload as { access_token?: string })?.access_token;
    if (typeof token === "string" && token) {
      await setAccessToken(token);
    }

    const plain = toPlainSerializable(root);
    if (plain == null) {
      return { error: "Failed to login", message: "Invalid response from server" };
    }
    return plain as Record<string, unknown>;
  } catch (err) {
    console.error("Login API error:", err);
    return { error: "Failed to login", message: "Failed to login" };
  }
};

const Logout = async (userId: string) => {
  const accessToken = await getAccessToken();
  console.log("accessToken", accessToken);

  try {
    const res = await axios.post(
      `${process.env.BACK_END}/accounts/logout`,
      {},
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        withCredentials: true,
      },
    );

    await clearAccessToken();

    return { data: { success: true } };
  } catch (error: any) {
    const errorMessage =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      "Failed to logout";
    console.error("Logout API error:", errorMessage, error?.response?.data);
    return { error: "Failed to logout", message: errorMessage };
  }
};

/** Returns whether the access-token cookie is visible to the server (for post-login polling). */
const verifyAccessTokenCookie = async () => {
  const token = await getAccessToken();
  return { ok: Boolean(token?.trim()) };
};

const getUserData = async () => {
  try {
    const accessToken = await getAccessToken();
    console.log("accessToken", accessToken);

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.get(`${process.env.BACK_END}/accounts/tokendata`, {
      headers: {
        "Content-Type": "application/json",
        withCredentials: true,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    console.log("res", res.data);
    // const removeAccess = authCookies.delete(accessTokenBack as string);
    // const removeRefresh = authCookies.delete(refreshTokenBack as string);

    // console.log("accessTokenBackName", accessTokenBack);
    // console.log("refreshTokenBackName", refreshTokenBack);
    return { data: toPlainSerializable(res.data) };
  } catch (error: any) {
    // Handle 401 Unauthorized errors
    if (error.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          error.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }
    // Handle other errors
    return {
      error: "Failed to get user data",
      message:
        error.response?.data?.message ||
        error.message ||
        "An unexpected error occurred",
    };
  }
};

function registerErrorMessage(
  data: unknown,
  status: number | undefined,
  fallback: string,
): string {
  if (data && typeof data === "object") {
    const body = data as Record<string, unknown>;
    if (typeof body.message === "string" && body.message.trim()) {
      return mapRegisterApiMessage(body.message, status, body.message.trim());
    }
    const errors = body.errors ?? body.Errors;
    if (errors && typeof errors === "object") {
      const lines = Object.entries(errors as Record<string, unknown>).flatMap(
        ([field, issues]) => {
          const list = Array.isArray(issues) ? issues : [issues];
          return list
            .map((issue) => String(issue).trim())
            .filter(Boolean)
            .map((issue) => `${field}: ${issue}`);
        },
      );
      if (lines.length > 0) return lines.join(" · ");
    }
  }
  return mapRegisterApiMessage(undefined, status, fallback);
}

const CheckNationalIdExists = async (nationalId: string) => {
  const trimmed = nationalId.trim();
  if (!trimmed) {
    return {
      exists: false,
      error: "InvalidFields",
      message: "رقم الهوية مطلوب",
    };
  }

  try {
    const res = await axios.get(
      `${process.env.BACK_END}/accounts/check-national-id/${encodeURIComponent(trimmed)}`,
    );

    const plain = toPlainSerializable(res.data) as Record<string, unknown> | null;
    const check = extractNationalIdCheckResult(plain);
    const message =
      typeof plain?.message === "string" ? plain.message : undefined;

    return {
      exists: check.exists,
      isEmployee: check.isEmployee,
      employeeId: check.employeeId,
      message: check.exists
        ? mapRegisterApiMessage(message, 409)
        : message,
    };
  } catch (error: unknown) {
    const err = error as {
      response?: { status?: number; data?: { message?: string } };
      message?: string;
    };
    const status = err?.response?.status;
    const apiMessage =
      typeof err?.response?.data?.message === "string"
        ? err.response.data.message
        : undefined;

    if (status === 400) {
      return {
        exists: false,
        notEmployee: apiMessage?.trim().toUpperCase() === "NOT_EMPLOYEE",
        error: "BadRequest",
        status,
        message: mapRegisterApiMessage(apiMessage, status),
      };
    }

    return {
      exists: false,
      error: "FailedToCheck",
      status,
      message:
        apiMessage ||
        err?.message ||
        "تعذر التحقق من رقم الهوية",
    };
  }
};

/**
 * Register a new user.
 *
 * IMPORTANT: Server Actions cannot receive `File` inside a plain object.
 * Pass a `FormData` instead, with keys matching the backend `RegisterDto`.
 */
const Register = async (formData: FormData) => {
  try {
    const res = await axios.post(
      `${process.env.BACK_END}/accounts/register`,
      formData,
    );

    const plain = toPlainSerializable(res.data);
    return plain != null && typeof plain === "object" && !Array.isArray(plain)
      ? (plain as Record<string, unknown>)
      : { result: plain };
  } catch (error: unknown) {
    const err = error as {
      response?: {
        status?: number;
        data?: { message?: string; errors?: unknown } & Record<string, unknown>;
      };
      message?: string;
    };
    const status = err?.response?.status;
    const data = err?.response?.data;
    const message = registerErrorMessage(
      data,
      status,
      err?.message || "Failed to register",
    );

    if (status === 400) {
      return {
        error: "BadRequest",
        status,
        message,
        data: data != null ? toPlainSerializable(data) : undefined,
      };
    }
    if (status === 409) {
      return {
        error: "Conflict",
        status,
        message,
        data: data != null ? toPlainSerializable(data) : undefined,
      };
    }
    return {
      error: "Failed to register",
      status,
      message,
      data: data != null ? toPlainSerializable(data) : undefined,
    };
  }
};

const ForgotPassword = async (values: z.infer<typeof ForgotPasswordSchema>) => {
  const validatedFields = ForgotPasswordSchema.safeParse(values);
  if (!validatedFields.success) {
    return { error: "Invalid Fields!", message: "يجب إدخال بريد إلكتروني صالح" };
  }

  try {
    const res = await axios.post(
      `${process.env.BACK_END}/accounts/forgotPassword`,
      { identifier: validatedFields.data.email.trim() },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const plain = toPlainSerializable(res.data);
    if (plain == null) {
      return {
        error: "Failed to reset password",
        message: "استجابة غير صالحة من الخادم",
      };
    }

    const root = plain as Record<string, unknown>;
    const message =
      typeof root.message === "string" && root.message.trim()
        ? root.message.trim()
        : "إذا كان الحساب موجوداً، ستصلك كلمة المرور الجديدة على بريدك الإلكتروني.";

    return { success: true, message, data: root };
  } catch (error: unknown) {
    const err = error as {
      response?: {
        status?: number;
        data?: { message?: string } & Record<string, unknown>;
      };
      message?: string;
    };
    const data = err?.response?.data;
    const message =
      (data && typeof data.message === "string" && data.message.trim()) ||
      err?.message ||
      "تعذر إعادة تعيين كلمة المرور. يُرجى المحاولة لاحقاً.";

    return {
      error: "Failed to reset password",
      status: err?.response?.status,
      message,
      data: data != null ? toPlainSerializable(data) : undefined,
    };
  }
};

const refreshTokenData = async (_values?: RefreshTokenInput) => {
  const result = await refreshAccessTokenOnce();

  if ("error" in result) {
    return {
      error: result.error,
      message: result.message || "Failed to refresh token",
    };
  }

  return {
    ok: true,
    refreshToken: result.refreshToken,
  };
};

/** Reads session cookies and refreshes tokens when needed. */
const refreshSession = async () => {
  const [userId, accessToken, refreshToken] = await Promise.all([
    getUserId(),
    getAccessToken(),
    getRefreshToken(),
  ]);

  if (!userId || !accessToken || !refreshToken) {
    return {
      error: "Unauthorized",
      message: "Missing session data. Please login again.",
    };
  }

  return refreshTokenData({ userId, accessToken, refreshToken });
};

export {
  Login,
  Logout,
  Register,
  CheckNationalIdExists,
  ForgotPassword,
  getUserData,
  refreshTokenData,
  refreshSession,
  verifyAccessTokenCookie,
};
