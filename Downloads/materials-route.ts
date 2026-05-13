import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const materials = await prisma.material.findMany({
    orderBy: { materialCode: "asc" },
    select: {
      materialCode: true,
      materialName: true,
    },
  })

  return NextResponse.json(materials)
}
