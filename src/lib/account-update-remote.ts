import axios from "axios";

function errorMessageFromAxios(data: unknown, fallback: string): string {
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object" && "message" in data) {
    const m = (data as { message: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return fallback;
}

export type AccountUpdateRemoteResult =
  | { success: true }
  | { error: string; message: string };

/** Matches `AccountsController.UpdateUserPersonalData` + `UpdateUserDto` (SonoBooking.Api). */
const UPDATE_USER_PERSONAL_DATA_PATH = "/accounts/updateUserPersonalData";

/**
 * Builds multipart form for `PUT .../accounts/updateUserPersonalData`.
 * Only sends properties present on backend `UpdateUserDto` (Id, UserName, Email,
 * passwords, RoleId, OrganizationId, DocumentImage). Other profile fields
 * require extending that DTO if the API should persist them.
 */
function buildUpdateUserPersonalDataFormData(
  data: Record<string, unknown>,
  identityAttachmentArg?: File | null,
): FormData {
  const fd = new FormData();
  const {
    id,
    userName,
    email,
    oldPassword,
    newPassword,
    confirmPassword,
    roleId,
    organizationId,
    identityAttachment: identityFromData,
  } = data;

  const identityFile =
    identityAttachmentArg instanceof File
      ? identityAttachmentArg
      : identityFromData instanceof File
        ? identityFromData
        : undefined;

  fd.append("Id", String(id ?? ""));
  fd.append("UserName", String(userName ?? ""));
  fd.append("Email", String(email ?? ""));
  fd.append("OldPassword", String(oldPassword ?? ""));
  fd.append("NewPassword", String(newPassword ?? ""));
  fd.append("ConfirmPassword", String(confirmPassword ?? ""));

  if (roleId != null && String(roleId).trim() !== "") {
    fd.append("RoleId", String(roleId));
  } else {
    fd.append("RoleId", "00000000-0000-0000-0000-000000000000");
  }

  if (organizationId != null && String(organizationId).trim() !== "") {
    fd.append("OrganizationId", String(organizationId));
  }

  if (identityFile instanceof File && identityFile.size > 0) {
    fd.append("DocumentImage", identityFile);
  }

  return fd;
}

/**
 * Calls backend `PUT .../accounts/updateUserPersonalData` ([FromForm] UpdateUserDto).
 * Used by the server action and by `/api/accounts/update` (no RSC `File` serialization).
 */
export async function runAccountUpdatePut(options: {
  apiBase: string;
  accessToken: string;
  data: Record<string, unknown>;
  identityAttachmentArg?: File | null;
}): Promise<AccountUpdateRemoteResult> {
  const { apiBase, accessToken, data, identityAttachmentArg } = options;

  const formData = buildUpdateUserPersonalDataFormData(
    data,
    identityAttachmentArg,
  );

  try {
    await axios.put(
      `${apiBase}${UPDATE_USER_PERSONAL_DATA_PATH}`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        withCredentials: true,
      },
    );
    return { success: true };
  } catch (error: any) {
    if (error.response?.status === 400) {
      return {
        error: "BadRequest",
        message: errorMessageFromAxios(
          error.response?.data,
          "بيانات غير صحيحة",
        ),
      };
    }

    if (error.response?.status === 401) {
      return {
        error: "Unauthorized",
        message: errorMessageFromAxios(
          error.response?.data,
          "Authentication failed. Please login again.",
        ),
      };
    }

    if (error.response?.status === 404) {
      return {
        error: "Not Found",
        message: errorMessageFromAxios(
          error.response?.data,
          "المستخدم غير موجود.",
        ),
      };
    }

    if (error.response?.status === 409) {
      return {
        error: "Conflict",
        message: errorMessageFromAxios(
          error.response?.data,
          "This user already exists.",
        ),
      };
    }

    if (error.response?.status === 500) {
      return {
        error: "Server Error",
        message: errorMessageFromAxios(
          error.response?.data,
          "Server error occurred. Please try again later.",
        ),
      };
    }

    return {
      error: "Failed to update user",
      message: errorMessageFromAxios(
        error.response?.data,
        error?.message || "An unexpected error occurred",
      ),
    };
  }
}
