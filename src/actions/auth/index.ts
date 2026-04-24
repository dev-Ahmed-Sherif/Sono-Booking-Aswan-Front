"use server";

import * as z from "zod";
import axios from "axios";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "@/lib/token-helper";

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
    const payload = res.data?.data ?? res.data;
    await setAccessToken(payload.accessToken);

    const refreshToken =
      payload.refreshToken ??
      (payload as any)?.refresh_token ??
      (res.data as any)?.refreshToken;
    return {
      ...res.data,
    };
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
    return { data: res.data };
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

    if (res.data.data.accessToken) {
      await setAccessToken(res.data.data.accessToken);
    }

    // Don't set refresh token server-side - let frontend set Ref_Tok_Sono_Net as non-HttpOnly cookie
    // if (res.data.data.refreshToken) {
    //   await setRefreshToken(res.data.data.refreshToken);
    // }

    // Return refreshToken so frontend can set it as Ref_Tok_Sono_Net
    return {
      ...res.data,
      refreshToken: res.data.data.refreshToken, // Include refreshToken for frontend to set as Ref_Tok_Sono_Net
    };
  } catch (error: any) {
    return {
      error: error.response?.data?.message || "Failed to refresh token",
    };
  }
};

export { Login, Logout, getUserData, refreshTokenData };
