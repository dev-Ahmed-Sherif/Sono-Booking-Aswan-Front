"use server";

import * as z from "zod";
import axios from "axios";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "@/lib/token-helper";
import { toPlainSerializable } from "@/lib/to-plain-serializable";

import { LoginSchema } from "@/schemas";

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
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
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
    const message =
      data?.message ||
      (status === 400
        ? "بيانات غير صحيحة"
        : status === 409
          ? "البريد الإلكتروني أو المستخدم مسجل مسبقاً"
          : err?.message || "Failed to register");

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

const refreshTokenData = async (values: RefreshTokenInput) => {
  try {
    const accessToken = await getAccessToken();
    const res = await axios.post(
      `${process.env.BACK_END}/accounts/refresh`,
      {
        userId: values.userId,
        accessToken: values.accessToken,
        refreshToken: values.refreshToken,
      },
      {
        headers: {
          "Content-Type": "application/json",
          withCredentials: true,
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    const plainRoot = toPlainSerializable(res.data) as Record<
      string,
      unknown
    > | null;
    if (!plainRoot || typeof plainRoot !== "object") {
      return {
        error: "Failed to refresh token",
        message: "Invalid response from server",
      };
    }

    const inner = (plainRoot.data ?? plainRoot) as Record<string, unknown>;
    const access = inner.accessToken ?? inner.AccessToken;
    if (typeof access === "string" && access) {
      await setAccessToken(access);
    }

    const refresh =
      inner.refreshToken ??
      inner.RefreshToken ??
      (plainRoot.refreshToken as string | undefined);

    return {
      ...plainRoot,
      refreshToken: typeof refresh === "string" ? refresh : undefined,
    };
  } catch (error: any) {
    return {
      error: error.response?.data?.message || "Failed to refresh token",
    };
  }
};

export { Login, Logout, Register, getUserData, refreshTokenData };
