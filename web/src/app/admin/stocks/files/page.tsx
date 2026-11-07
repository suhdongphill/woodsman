import { redirect } from "next/navigation";

/** 올리기는 「종목 보고서」 화면으로 합쳤다(2026-11-07). 예전 주소도 그리로 보낸다. */
export default function AdminReportFilesPage(): never {
  redirect("/admin/stocks");
}
