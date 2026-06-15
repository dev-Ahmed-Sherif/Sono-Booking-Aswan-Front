import axios from "axios";

import { toPlainSerializable } from "@/lib/to-plain-serializable";

function mapAxiosBedError(error: unknown): {
  error: string;
  message: string;
} {
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

/**
 * PUT multipart to `Beds/update` ([FromForm]).
 * Used by `/api/beds/update` — files are not relayed reliably through Server Actions.
 */
export async function runBedUpdatePut(options: {
  apiBase: string;
  accessToken: string;
  formData: FormData;
}): Promise<unknown> {
  const { apiBase, accessToken, formData } = options;

  try {
    const res = await axios.put(`${apiBase}/Beds/update`, formData, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      withCredentials: true,
    });
    return toPlainSerializable(res.data);
  } catch (error: unknown) {
    return mapAxiosBedError(error);
  }
}
