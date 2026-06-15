"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import {
  Ban,
  CalendarDays,
  CalendarIcon,
  Eye,
  Loader2,
  Moon,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { getAvailableUnits } from "@/actions/availabilityService";
import {
  getCompanionById,
  getCompanions,
  getCompanionsForRequestOwner,
} from "@/actions/companionService";
import { getUserById } from "@/actions/permissions/userService";
import { getAllocationTypes } from "@/actions/settings/allocationTypeService";
import { getRequestTypes } from "@/actions/settings/requestTypeService";
import {
  getRequestById,
  getRequestParticipantsAll,
  getRequestUnitsAll,
  softDeleteRequestById,
  updateRequestById,
} from "@/actions/requestService";
import AlertModal from "@/components/modals/alert-modal";
import useToggleState from "@/hooks/use-toggle-state";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useToast } from "@/hooks/use-toast";
import {
  availabilityCardKey,
  fetchMergedAvailabilityCards,
  getLookupArray,
  hierarchyFilteredAvailabilityLists,
  mapGenericOptions,
  formatStoredUnitLabel,
  toReservationStoredUnits,
  type AvailabilityUnitCard,
  type ReservationStoredUnitSnapshot,
} from "@/lib/availability-inquiry";
import { cn } from "@/lib/utils";
import {
  extractAvailabilityList,
  parseGuestGenderStrict,
  resolveGuestsForReservationValidation,
  resolvePersonGuestGender,
  type GuestGender,
} from "@/lib/reservation-guest-unit-validation";
import {
  applyCompanionDisplayNameToMap,
  buildCompanionDisplayMapForIds,
  buildCompanionGenderMap,
  buildUpdateRequestPayload,
  buildRequestOldImagesPayload,
  companionDisplayNameFromRecord,
  lookupCompanionName,
  extractApiEntity,
  extractCompanionIdsFromParticipantRows,
  extractRequestUserId,
  filterRowsByRequestId,
  resolveParticipantRowsForRequest,
  parseRequestDetail,
  parseRequestAttachesFromApi,
  parseRequestUnitFromApi,
  resolveInquiryGendersForRequest,
  type HousingRequestAttachmentSnapshot,
  type HousingRequestDetail,
} from "@/lib/housing-request-detail";
import {
  buildAddRequestFormData,
  type AddRequestUnitDtoPayload,
  enrichStoredUnitsWithHierarchyIds,
  formatAddRequestErrorMessage,
  mapStoredUnitToRequestUnitDto,
  parseAllocationTypeEnum,
  prepareHousingRequestForSubmit,
  requestUnitDtosToEnrichedSnapshots,
} from "@/lib/housing-request-map";
import { submitUpdateRequestFormData } from "@/lib/request-add-client";
import { formDataHasFileEntries } from "@/lib/form-data-relay";
import { RequestAttachmentsInput } from "@/components/reservation/request-attachments-input";
import { RequestSavedAttachmentsList } from "@/components/reservation/request-saved-attachments-list";
import {
  canCancelHousingRequest,
  canEditHousingRequest,
  isHousingRequestStatusLocked,
  type HousingRequestTableRow,
} from "@/lib/housing-request-list";
import { HOUSING_REQUEST_CATAGORY_EXTENSION } from "@/lib/housing-request-map";

type ModalMode = "view" | "edit";

type HousingRequestDetailModalProps = {
  open: boolean;
  mode: ModalMode;
  requestId: string | null;
  statusLabel: string;
  /** Row snapshot from «طلباتى السابقة» — keeps summary fields in sync with the table. */
  tableRow?: HousingRequestTableRow | null;
  /**
   * `RequestDto.UserId` — request owner. When set (housing sender / leader), companions
   * API always uses this id in the `UserId` header, not the logged-in user from localStorage.
   */
  requestOwnerUserId?: string;
  requestTypeLabelsById?: Map<string, string>;
  onClose: () => void;
  onChanged?: () => void;
};

function mergeDetailWithTableRow(
  detail: HousingRequestDetail,
  row: HousingRequestTableRow,
): HousingRequestDetail {
  const allocation =
    row.requestAllocationType === "مرن"
      ? 2
      : row.requestAllocationType === "ثابت"
        ? 1
        : detail.requestAllocationType;

  return {
    ...detail,
    startDate: row.startDate !== "—" ? row.startDate : detail.startDate,
    nights: row.nights > 0 ? row.nights : detail.nights,
    requestAllocationType: allocation,
    requestClassificationLabel: row.requestClassification,
    requestTypeLabel: row.requestType,
    requestAllocationTypeLabel: row.requestAllocationType,
    statusLabel: row.status || detail.statusLabel,
  };
}

const ADD_UNIT_PLACEHOLDER = "__add_unit__";

type LookupOption = { value: string; label: string };

type EditFieldErrors = {
  startDate?: string;
  nights?: string;
  requestType?: string;
  allocationType?: string;
};

function resolveRequestTypeIdFromLabel(
  requestTypeId: string,
  requestTypeLabel: string,
  options: LookupOption[],
): string {
  if (requestTypeId.trim()) return requestTypeId.trim();
  const label = requestTypeLabel.trim();
  if (!label) return "";
  const match = options.find((o) => o.label.trim() === label);
  return match?.value ?? "";
}

export function HousingRequestDetailModal({
  open,
  mode,
  requestId,
  statusLabel,
  tableRow = null,
  requestOwnerUserId: requestOwnerUserIdProp,
  requestTypeLabelsById,
  onClose,
  onChanged,
}: HousingRequestDetailModalProps) {
  const { toast } = useToast();
  const userStorage = useLocalStorage("user");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<HousingRequestDetail | null>(null);
  const [unitSnapshots, setUnitSnapshots] = useState<
    ReservationStoredUnitSnapshot[]
  >([]);
  const [companionIds, setCompanionIds] = useState<string[]>([]);
  const [companionNames, setCompanionNames] = useState<Map<string, string>>(
    new Map(),
  );
  const [companionGenderById, setCompanionGenderById] = useState<
    Map<string, GuestGender>
  >(new Map());
  const [inquiryGenders, setInquiryGenders] = useState<GuestGender[]>([]);
  const [unitCards, setUnitCards] = useState<AvailabilityUnitCard[]>([]);
  const [addUnitKey, setAddUnitKey] = useState("");
  const [addCompanionId, setAddCompanionId] = useState("");
  const [requestTypeOptions, setRequestTypeOptions] = useState<LookupOption[]>(
    [],
  );
  const [allocationTypeOptions, setAllocationTypeOptions] = useState<
    LookupOption[]
  >([]);
  const [editFieldErrors, setEditFieldErrors] = useState<EditFieldErrors>({});
  const [nightsInput, setNightsInput] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<
    HousingRequestAttachmentSnapshot[]
  >([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState(
    () => new Set<string>(),
  );
  const [requestOwnerUserId, setRequestOwnerUserId] = useState("");

  const isEdit = mode === "edit";
  const isExtensionRequest =
    detail?.requestCatagory === HOUSING_REQUEST_CATAGORY_EXTENSION;
  const editLocked = !canEditHousingRequest(detail?.statusLabel ?? statusLabel);
  const canSaveEdits = isEdit && canEditHousingRequest(detail?.statusLabel ?? statusLabel);
  const currentYear = new Date().getFullYear();
  const maxSelectableDate = new Date(currentYear + 5, 11, 31);
  const minSelectableDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const visibleExistingAttachments = useMemo(
    () =>
      existingAttachments.filter(
        (attachment) => !removedAttachmentIds.has(attachment.id),
      ),
    [existingAttachments, removedAttachmentIds],
  );

  const patchDetail = useCallback(
    (partial: Partial<HousingRequestDetail>) => {
      setDetail((prev) => (prev ? { ...prev, ...partial } : prev));
    },
    [],
  );

  const loadDetail = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    setDetail(null);
    setUnitSnapshots([]);
    setCompanionIds([]);
    setCompanionGenderById(new Map());
    setInquiryGenders([]);
    setExistingAttachments([]);
    setRemovedAttachmentIds(new Set());
    setRequestOwnerUserId("");
    try {
      const reqRes = await getRequestById(requestId);
      const reqRawEarly = extractApiEntity(reqRes);
      const ownerUserIdFromApi = reqRawEarly
        ? extractRequestUserId(reqRawEarly)
        : "";
      const ownerUserId = (
        requestOwnerUserIdProp?.trim() || ownerUserIdFromApi
      ).trim();
      setRequestOwnerUserId(ownerUserId);

      const companionsListPromise = requestOwnerUserIdProp?.trim()
        ? getCompanionsForRequestOwner(requestOwnerUserIdProp.trim())
        : ownerUserId
          ? getCompanionsForRequestOwner(ownerUserId)
          : getCompanions();

      const [
        unitsRes,
        partsRes,
        compRes,
        bedsRes,
        roomsRes,
        aptRes,
        requestTypesRes,
        allocationTypesRes,
      ] = await Promise.all([
        getRequestUnitsAll(),
        ownerUserId
          ? getRequestParticipantsAll(ownerUserId)
          : getRequestParticipantsAll(),
        companionsListPromise,
        getAvailableUnits("bed"),
        getAvailableUnits("room"),
        getAvailableUnits("apartment"),
        isEdit ? getRequestTypes() : Promise.resolve(null),
        isEdit ? getAllocationTypes() : Promise.resolve(null),
      ]);

      const reqRaw = extractApiEntity(reqRes);
      if (!reqRaw) {
        toast({
          variant: "destructive",
          title: "تعذر تحميل الطلب",
          description: "لم يتم العثور على بيانات الطلب.",
        });
        return;
      }

      let parsedDetail = parseRequestDetail(reqRaw, statusLabel, {
        requestTypeLabelsById,
      });
      if (!parsedDetail) {
        toast({
          variant: "destructive",
          title: "تعذر تحميل الطلب",
          description: "بيانات الطلب غير صالحة.",
        });
        return;
      }

      if (tableRow) {
        parsedDetail = mergeDetailWithTableRow(parsedDetail, tableRow);
      }

      let loadedRequestTypeOptions: LookupOption[] = [];
      if (isEdit) {
        if (!(requestTypesRes as { error?: string } | null)?.error) {
          const mapped = mapGenericOptions(requestTypesRes);
          if (mapped.length > 0) {
            loadedRequestTypeOptions = mapped;
            setRequestTypeOptions(mapped);
          }
        }
        if (!(allocationTypesRes as { error?: string } | null)?.error) {
          const mapped = mapGenericOptions(allocationTypesRes);
          if (mapped.length > 0) setAllocationTypeOptions(mapped);
        }
        const resolvedTypeId = resolveRequestTypeIdFromLabel(
          parsedDetail.requestTypeId,
          parsedDetail.requestTypeLabel,
          loadedRequestTypeOptions,
        );
        if (resolvedTypeId) {
          parsedDetail = {
            ...parsedDetail,
            requestTypeId: resolvedTypeId,
            requestTypeLabel:
              loadedRequestTypeOptions.find((o) => o.value === resolvedTypeId)
                ?.label ?? parsedDetail.requestTypeLabel,
          };
        }
      }

      const unitRows = filterRowsByRequestId(
        getLookupArray(unitsRes),
        requestId,
      );
      const participantRows = resolveParticipantRowsForRequest(
        reqRaw,
        partsRes,
        requestId,
        reqRes,
      );

      const parsedUnits = unitRows
        .map(parseRequestUnitFromApi)
        .filter((u): u is AddRequestUnitDtoPayload => u != null);

      const bedsRaw = extractAvailabilityList(bedsRes);
      const roomsRaw = extractAvailabilityList(roomsRes);
      const apartmentsRaw = extractAvailabilityList(aptRes);

      const enriched = requestUnitDtosToEnrichedSnapshots(
        parsedUnits,
        bedsRaw,
        roomsRaw,
        apartmentsRaw,
      );

      const companions = extractCompanionIdsFromParticipantRows(
        participantRows,
      );

      setDetail(parsedDetail);
      setExistingAttachments(parseRequestAttachesFromApi(reqRaw));
      setNightsInput(
        parsedDetail.nights > 0 ? String(parsedDetail.nights) : "",
      );
      setEditFieldErrors({});
      setUnitSnapshots(enriched);
      setCompanionIds(companions);

      const displayMap = buildCompanionDisplayMapForIds(
        participantRows,
        companions,
        compRes,
      );

      const companionsHeaderUserId = ownerUserId || undefined;

      const missingNames = companions.filter(
        (id) => !lookupCompanionName(displayMap, id),
      );
      if (missingNames.length > 0) {
        await Promise.all(
          missingNames.map(async (companionId) => {
            const res = companionsHeaderUserId
              ? await getCompanionById(companionId, companionsHeaderUserId)
              : await getCompanionById(companionId);
            const raw = extractApiEntity(res);
            if (!raw) return;
            const name = companionDisplayNameFromRecord(raw);
            if (name) {
              applyCompanionDisplayNameToMap(displayMap, companionId, name);
            }
          }),
        );
      }

      setCompanionNames(displayMap);
      setCompanionGenderById(
        compRes && !(compRes as { error?: string }).error
          ? buildCompanionGenderMap(compRes)
          : new Map(),
      );
      setInquiryGenders(
        resolveInquiryGendersForRequest(reqRaw, enriched, {
          bedsRaw,
          roomsRaw,
          apartmentsRaw,
        }),
      );

      if (isEdit) {
        const { cards } = await fetchMergedAvailabilityCards([
          "bed",
          "room",
          "apartment",
        ]);
        setUnitCards(cards);
      }
    } catch {
      toast({
        variant: "destructive",
        title: "تعذر تحميل الطلب",
        description: "حدث خطأ أثناء جلب البيانات.",
      });
    } finally {
      setLoading(false);
    }
  }, [
    isEdit,
    mode,
    requestId,
    requestOwnerUserIdProp,
    statusLabel,
    tableRow,
    requestTypeLabelsById,
  ]);

  const loadDetailRef = useRef(loadDetail);
  loadDetailRef.current = loadDetail;
  const detailFetchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !requestId) {
      setAddUnitKey("");
      setAddCompanionId("");
      setAttachmentFiles([]);
      setExistingAttachments([]);
      setRemovedAttachmentIds(new Set());
      detailFetchKeyRef.current = null;
      return;
    }

    const fetchKey = `${requestId}:${mode}`;
    if (detailFetchKeyRef.current === fetchKey) return;
    detailFetchKeyRef.current = fetchKey;

    void loadDetailRef.current();
  }, [open, requestId, mode]);

  const availableUnitOptions = useMemo(() => {
    const selectedKeys = new Set(
      unitSnapshots.map((u) => `${u.unitKind}:${u.id}`),
    );
    return unitCards.filter(
      (c) => !selectedKeys.has(availabilityCardKey(c)),
    );
  }, [unitCards, unitSnapshots]);

  const availableCompanions = useMemo(() => {
    const chosen = new Set(companionIds);
    return Array.from(companionNames.entries()).filter(([id]) => !chosen.has(id));
  }, [companionIds, companionNames]);

  const handleAddUnit = async (cardKey: string) => {
    const card = unitCards.find((c) => availabilityCardKey(c) === cardKey);
    if (!card) return;
    const [bedsRes, roomsRes, aptRes] = await Promise.all([
      getAvailableUnits("bed"),
      getAvailableUnits("room"),
      getAvailableUnits("apartment"),
    ]);
    const { bedsRaw, roomsRaw, apartmentsRaw } =
      await hierarchyFilteredAvailabilityLists({
        bedsRaw: extractAvailabilityList(bedsRes),
        roomsRaw: extractAvailabilityList(roomsRes),
        apartmentsRaw: extractAvailabilityList(aptRes),
      });
    const enriched = enrichStoredUnitsWithHierarchyIds(
      toReservationStoredUnits([card]),
      bedsRaw,
      roomsRaw,
      apartmentsRaw,
    );
    const mapped = mapStoredUnitToRequestUnitDto(enriched[0]);
    if (!mapped.ok) {
      toast({
        variant: "destructive",
        title: "لا يمكن إضافة الوحدة",
        description: mapped.message,
      });
      return;
    }
    setUnitSnapshots((prev) => [...prev, enriched[0]]);
    setAddUnitKey("");
  };

  const validateEditFields = (): HousingRequestDetail | null => {
    if (!detail) return null;
    const nextErrors: EditFieldErrors = {};
    const nightsNumber = Number(nightsInput.trim());
    const extensionOnly =
      detail.requestCatagory === HOUSING_REQUEST_CATAGORY_EXTENSION;

    if (!detail.startDate.trim()) {
      nextErrors.startDate = "يرجى اختيار تاريخ البدء";
    }
    if (!nightsInput.trim()) {
      nextErrors.nights = "يرجى إدخال عدد الليالي";
    } else if (!Number.isFinite(nightsNumber) || nightsNumber < 1) {
      nextErrors.nights = "عدد الليالي يجب أن يكون 1 على الأقل";
    } else if (nightsNumber > 21) {
      nextErrors.nights = "عدد الليالي يجب ألا يتجاوز 21 ليلة";
    }
    if (!extensionOnly && !detail.requestTypeId.trim()) {
      nextErrors.requestType = "يرجى اختيار نوع الطلب";
    }
    if (
      detail.requestAllocationType !== 1 &&
      detail.requestAllocationType !== 2
    ) {
      nextErrors.allocationType = "يرجى اختيار نوع الحجز";
    }

    if (Object.keys(nextErrors).length > 0) {
      setEditFieldErrors(nextErrors);
      toast({
        variant: "destructive",
        title: "بيانات ناقصة",
        description: "يرجى تعبئة جميع الحقول قبل الحفظ",
      });
      return null;
    }

    setEditFieldErrors({});
    return { ...detail, nights: nightsNumber };
  };

  const handleRemoveSavedAttachment = useCallback(
    (attachment: HousingRequestAttachmentSnapshot) => {
      const id = attachment.id.trim();
      if (!id) return;
      setRemovedAttachmentIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    },
    [],
  );

  const handleSave = async () => {
    if (!detail) return;
    if (editLocked) {
      toast({
        variant: "destructive",
        title: "لا يمكن التعديل",
        description: "لا يمكن تعديل الطلب في حالته الحالية.",
      });
      return;
    }
    const validatedDetail = isEdit ? validateEditFields() : detail;
    if (!validatedDetail) return;
    if (unitSnapshots.length === 0) {
      toast({
        variant: "destructive",
        title: "لا يمكن الحفظ",
        description: "يجب اختيار وحدة واحدة على الأقل.",
      });
      return;
    }

    const u = userStorage.getItem() as { name?: string } | undefined;
    const applicantName =
      typeof u?.name === "string" && u.name.trim().length > 0
        ? u.name.trim()
        : "طالب الإقامة";

    const guestsForValidation = [
      {
        id: "applicant",
        name: applicantName,
        role: "applicant" as const,
      },
      ...companionIds.map((id) => ({
        id,
        name: lookupCompanionName(companionNames, id),
        role: "companion" as const,
      })),
    ];

    setSaving(true);
    try {
      const inquiryStartYmd = validatedDetail?.startDate?.trim();
      const inquiryDates =
        inquiryStartYmd != null
          ? {
              startDateYmd: inquiryStartYmd,
              nights: validatedDetail?.nights,
            }
          : undefined;

      const [bedsRes, roomsRes, aptRes] = await Promise.all([
        getAvailableUnits("bed", inquiryDates),
        getAvailableUnits("room", inquiryDates),
        getAvailableUnits("apartment", inquiryDates),
      ]);
      const { bedsRaw, roomsRaw, apartmentsRaw } =
        await hierarchyFilteredAvailabilityLists({
          bedsRaw: extractAvailabilityList(bedsRes),
          roomsRaw: extractAvailabilityList(roomsRes),
          apartmentsRaw: extractAvailabilityList(aptRes),
          inquiry: inquiryDates,
        });

      let applicantGender: GuestGender | undefined;
      try {
        const userRaw =
          typeof window !== "undefined"
            ? window.localStorage.getItem("user")
            : null;
        if (userRaw && userRaw !== "undefined" && userRaw !== "null") {
          const user = JSON.parse(userRaw) as { id?: string };
          const id = user?.id ? String(user.id).trim() : "";
          if (id) {
            const res = await getUserById(id);
            const data = (res as { data?: Record<string, unknown> })?.data;
            if (data && !(res as { error?: string })?.error) {
              applicantGender =
                parseGuestGenderStrict(data.gender ?? data.Gender) ??
                resolvePersonGuestGender(data);
            }
          }
        }
      } catch {
        // ignore
      }

      const genderById = new Map(companionGenderById);
      const validatedGuestRows =
        resolveGuestsForReservationValidation(guestsForValidation);
      const missingCompanionIds = validatedGuestRows
        .filter((g) => g.role === "companion")
        .map((g) => g.id)
        .filter((id) => !genderById.has(id));

      if (missingCompanionIds.length > 0 && requestOwnerUserId) {
        const compRes = await getCompanionsForRequestOwner(requestOwnerUserId);
        if (!(compRes as { error?: string })?.error) {
          for (const raw of getLookupArray(compRes)) {
            const r = raw as Record<string, unknown>;
            const id = String(r.id ?? r.Id ?? "").trim();
            if (!id || !missingCompanionIds.includes(id)) continue;
            const g = resolvePersonGuestGender(r);
            if (g) genderById.set(id, g);
          }
        }
      }

      const prepared = prepareHousingRequestForSubmit({
        guests: guestsForValidation,
        inquiryGenders,
        units: unitSnapshots,
        bedsRaw,
        roomsRaw,
        apartmentsRaw,
        getGuestGender: (guestId) => {
          if (guestId === "applicant") return applicantGender;
          return genderById.get(guestId);
        },
      });

      if (!prepared.ok) {
        toast({
          variant: "destructive",
          title: "لا يمكن الحفظ",
          description: prepared.message,
        });
        return;
      }

      const companionsForSubmit = validatedGuestRows
        .filter((g) => g.role === "companion")
        .map((g) => g.id.trim())
        .filter(Boolean);

      const payload = {
        ...buildUpdateRequestPayload(
          validatedDetail,
          prepared.requestUnits,
          companionsForSubmit,
        ),
        ...(!isExtensionRequest
          ? {
              oldImages: buildRequestOldImagesPayload(
                visibleExistingAttachments,
              ),
            }
          : {}),
      };
      const formData = buildAddRequestFormData(payload, attachmentFiles);
      const res = formDataHasFileEntries(formData)
        ? await submitUpdateRequestFormData(formData)
        : await updateRequestById(payload);
      if (res && typeof res === "object" && "error" in res) {
        const err = res as { message?: string };
        toast({
          variant: "destructive",
          title: "فشل التحديث",
          description: formatAddRequestErrorMessage(
            String(err.message ?? "فشل التحديث"),
          ),
        });
        return;
      }

      setAttachmentFiles([]);
      setRemovedAttachmentIds(new Set());
      toast({ title: "تم التحديث", description: "تم حفظ تعديلات الطلب." });
      onChanged?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const title =
    mode === "view" ? "تفاصيل طلب الإقامة" : "تعديل طلب الإقامة";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        dir="rtl"
        className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto text-right"
      >
        <DialogHeader className="items-center text-center sm:items-center sm:text-center">
          <DialogTitle className="w-full text-center text-xl">
            {title}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            جاري التحميل...
          </div>
        ) : detail ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
              <div>
                <span className="text-muted-foreground">رقم الطلب: </span>
                <span className="font-medium">
                  {tableRow?.requestNo ?? detail.requestNumber}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">تصنيف الطلب: </span>
                <span className="font-medium">
                  {detail.requestClassificationLabel}
                </span>
              </div>
              {isEdit && !isExtensionRequest ? (
                <>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-gray-700 text-base flex items-center gap-1">
                      نوع الطلب
                      <span className="text-red-500 text-xs">*</span>
                    </Label>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {requestTypeOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            patchDetail({
                              requestTypeId: opt.value,
                              requestTypeLabel: opt.label,
                            });
                            setEditFieldErrors((prev) => ({
                              ...prev,
                              requestType: undefined,
                            }));
                          }}
                          className={cn(
                            "py-2.5 px-3 rounded-xl border-2 font-medium text-sm transition-all duration-200 whitespace-nowrap shrink-0 min-w-[calc((100%-1rem)/3)]",
                            detail.requestTypeId === opt.value
                              ? "bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30 scale-[1.02]"
                              : "bg-white border-gray-300 text-gray-600 hover:bg-blue-50 hover:border-blue-300",
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {editFieldErrors.requestType ? (
                      <p className="text-xs text-red-600">
                        {editFieldErrors.requestType}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : !isEdit ? (
                <>
                  <div>
                    <span className="text-muted-foreground">نوع الطلب: </span>
                    <span className="font-medium">
                      {detail.requestTypeLabel}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">نوع الحجز: </span>
                    <span className="font-medium">
                      {detail.requestAllocationTypeLabel}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">تاريخ البدء: </span>
                    <span className="font-medium">{detail.startDate}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">الليالي: </span>
                    <span className="font-medium">
                      {detail.nights.toLocaleString("ar-EG")}
                    </span>
                  </div>
                </>
              ) : (
                <div>
                  <span className="text-muted-foreground">نوع الطلب: </span>
                  <span className="font-medium">{detail.requestTypeLabel}</span>
                </div>
              )}
              {isEdit ? (
                <>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-gray-700 text-base flex items-center gap-1">
                      نوع الحجز
                      <span className="text-red-500 text-xs">*</span>
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      {allocationTypeOptions.map((opt) => {
                        const alloc =
                          parseAllocationTypeEnum(opt.value) ??
                          parseAllocationTypeEnum(opt.label);
                        if (!alloc) return null;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              patchDetail({
                                requestAllocationType: alloc,
                                requestAllocationTypeLabel:
                                  alloc === 2 ? "مرن" : "ثابت",
                              });
                              setEditFieldErrors((prev) => ({
                                ...prev,
                                allocationType: undefined,
                              }));
                            }}
                            className={cn(
                              "py-2.5 rounded-xl border-2 font-medium text-sm transition-all duration-200",
                              detail.requestAllocationType === alloc
                                ? "bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30 scale-[1.02]"
                                : "bg-white border-gray-300 text-gray-600 hover:bg-blue-50 hover:border-blue-300",
                            )}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    {editFieldErrors.allocationType ? (
                      <p className="text-xs text-red-600">
                        {editFieldErrors.allocationType}
                      </p>
                    ) : null}
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-gray-700 flex items-center gap-1.5 text-base">
                      <CalendarDays className="h-4 w-4 text-blue-500" />
                      تاريخ البدء
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          dir="rtl"
                          className={cn(
                            "h-12 w-full justify-between text-right text-base font-normal bg-white border-2 border-black text-gray-800 hover:bg-gray-50 px-3",
                            !detail.startDate && "text-muted-foreground",
                          )}
                        >
                          <span>
                            {detail.startDate
                              ? format(
                                  new Date(`${detail.startDate}T12:00:00`),
                                  "PPP",
                                  { locale: ar },
                                )
                              : "اختر التاريخ"}
                          </span>
                          <CalendarIcon className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="z-[10002] w-auto p-0 pointer-events-auto"
                        align="start"
                        dir="rtl"
                      >
                        <Calendar
                          mode="single"
                          selected={
                            detail.startDate
                              ? new Date(`${detail.startDate}T12:00:00`)
                              : undefined
                          }
                          onSelect={(date) => {
                            patchDetail({
                              startDate: date
                                ? format(date, "yyyy-MM-dd")
                                : "",
                            });
                            setEditFieldErrors((prev) => ({
                              ...prev,
                              startDate: undefined,
                            }));
                          }}
                          locale={ar}
                          disabled={(date) =>
                            date > maxSelectableDate ||
                            date < minSelectableDate
                          }
                          initialFocus
                          captionLayout="dropdown"
                          toYear={currentYear + 5}
                        />
                      </PopoverContent>
                    </Popover>
                    {editFieldErrors.startDate ? (
                      <p className="text-xs text-red-600">
                        {editFieldErrors.startDate}
                      </p>
                    ) : null}
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-gray-700 flex items-center gap-1.5 text-base">
                      <Moon className="h-4 w-4 text-blue-500" />
                      عدد الليالي
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={21}
                      placeholder="أدخل عدد الليالي"
                      value={nightsInput}
                      onChange={(e) => {
                        setNightsInput(e.target.value);
                        setEditFieldErrors((prev) => ({
                          ...prev,
                          nights: undefined,
                        }));
                      }}
                      className="h-12 bg-white border-black text-gray-800 text-base"
                    />
                    {editFieldErrors.nights ? (
                      <p className="text-xs text-red-600">
                        {editFieldErrors.nights}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : null}
              <div>
                <span className="text-muted-foreground">الحالة: </span>
                <span className="font-medium">{detail.statusLabel}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">وحدات الطلب</Label>
              <ul className="space-y-2 rounded-lg border p-3">
                {unitSnapshots.length === 0 ? (
                  <li className="text-sm text-muted-foreground">
                    لا توجد وحدات.
                  </li>
                ) : (
                  unitSnapshots.map((unit, idx) => (
                    <li
                      key={`${unit.unitKind}:${unit.id}-${idx}`}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span>{formatStoredUnitLabel(unit)}</span>
                      {isEdit && !isExtensionRequest ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() =>
                            setUnitSnapshots((prev) =>
                              prev.filter((_, i) => i !== idx),
                            )
                          }
                          aria-label="حذف الوحدة"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
              {isEdit && !isExtensionRequest && availableUnitOptions.length > 0 ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[200px] flex-1">
                    <Select
                      value={addUnitKey || ADD_UNIT_PLACEHOLDER}
                      onValueChange={(v) => {
                        if (v === ADD_UNIT_PLACEHOLDER) return;
                        void handleAddUnit(v);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="إضافة وحدة" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ADD_UNIT_PLACEHOLDER} disabled>
                          اختر وحدة لإضافتها
                        </SelectItem>
                        {availableUnitOptions.map((card) => {
                          const key = availabilityCardKey(card);
                          return (
                            <SelectItem key={key} value={key}>
                              {card.title}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={!addUnitKey}
                    onClick={() => addUnitKey && void handleAddUnit(addUnitKey)}
                  >
                    <Plus className="h-4 w-4" />
                    إضافة
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">المرافقون</Label>
              <ul className="space-y-2 rounded-lg border p-3">
                {companionIds.length === 0 ? (
                  <li className="text-sm text-muted-foreground">
                    لا يوجد مرافقون.
                  </li>
                ) : (
                  companionIds.map((id, idx) => (
                    <li
                      key={id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span>
                        {lookupCompanionName(companionNames, id) || "—"}
                      </span>
                      {isEdit && !isExtensionRequest ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() =>
                            setCompanionIds((prev) =>
                              prev.filter((_, i) => i !== idx),
                            )
                          }
                          aria-label="حذف المرافق"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
              {isEdit && !isExtensionRequest && availableCompanions.length > 0 ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[200px] flex-1">
                    <Select
                      value={addCompanionId || "__none__"}
                      onValueChange={(v) => {
                        if (v === "__none__") return;
                        setCompanionIds((prev) =>
                          prev.includes(v) ? prev : [...prev, v],
                        );
                        setAddCompanionId("");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="إضافة مرافق" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__" disabled>
                          اختر مرافقاً
                        </SelectItem>
                        {availableCompanions.map(([id, name]) => (
                          <SelectItem key={id} value={id}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}
            </div>

            {!isExtensionRequest &&
            (visibleExistingAttachments.length > 0 || isEdit) ? (
              <RequestSavedAttachmentsList
                attachments={visibleExistingAttachments}
                showUploadHint={isEdit}
                editable={isEdit}
                disabled={saving || loading}
                onRemove={handleRemoveSavedAttachment}
              />
            ) : null}

            {isEdit && !isExtensionRequest ? (
              <RequestAttachmentsInput
                files={attachmentFiles}
                onChange={setAttachmentFiles}
                disabled={saving || loading}
              />
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-center">
          {canSaveEdits ? (
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || loading || !detail}
            >
              {saving ? (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              ) : null}
              حفظ التعديلات
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={onClose}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type HousingRequestRowActionsProps = {
  row: HousingRequestTableRow;
  onView: (row: HousingRequestTableRow) => void;
  onEdit: (row: HousingRequestTableRow) => void;
  onCancel: (row: HousingRequestTableRow) => void;
  onDelete: (id: string) => void;
  deleting?: boolean;
  canceling?: boolean;
};

export function HousingRequestRowActions({
  row,
  onView,
  onEdit,
  onCancel,
  onDelete,
  deleting,
  canceling,
}: HousingRequestRowActionsProps) {
  const [deleteOpen, toggleDeleteOpen] = useToggleState(false);
  const [cancelOpen, toggleCancelOpen] = useToggleState(false);
  const deleteLocked = isHousingRequestStatusLocked(row.status);
  const showEdit = canEditHousingRequest(row.status);
  const showCancel = canCancelHousingRequest(row.status);

  const onConfirmDelete = async () => {
    await onDelete(row.id);
    toggleDeleteOpen();
  };

  const onConfirmCancel = async () => {
    await onCancel(row);
    toggleCancelOpen();
  };

  return (
    <>
      <AlertModal
        isOpen={deleteOpen}
        loading={Boolean(deleting)}
        onClose={toggleDeleteOpen}
        onConfirm={onConfirmDelete}
      />
      <AlertModal
        isOpen={cancelOpen}
        loading={Boolean(canceling)}
        onClose={toggleCancelOpen}
        onConfirm={onConfirmCancel}
        title="إلغاء الطلب"
        description="سيتم تغيير حالة الطلب إلى «ملغى»."
        loadingMessage="جاري الإلغاء..."
        confirmLabel="تأكيد الإلغاء"
      />
    <div className="flex flex-wrap items-center justify-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9"
        title="عرض التفاصيل"
        onClick={() => onView(row)}
      >
        <Eye className="h-4 w-4" />
      </Button>
      {showEdit ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9"
          title="تعديل"
          onClick={() => onEdit(row)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      ) : null}
      {showCancel ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 text-amber-700 hover:text-amber-800"
          title="إلغاء الطلب"
          disabled={canceling}
          onClick={toggleCancelOpen}
        >
          {canceling ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Ban className="h-4 w-4" />
          )}
        </Button>
      ) : null}
      {!deleteLocked ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 text-destructive hover:text-destructive"
          title="حذف"
          disabled={deleting}
          onClick={toggleDeleteOpen}
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      ) : null}
    </div>
    </>
  );
}

export async function deleteHousingRequest(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await softDeleteRequestById(id);
  if (res && typeof res === "object" && "error" in res) {
    return {
      ok: false,
      message: String(
        (res as { message?: string }).message ?? "فشل حذف الطلب",
      ),
    };
  }
  return { ok: true };
}
