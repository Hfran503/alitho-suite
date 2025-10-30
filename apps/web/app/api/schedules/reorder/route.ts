import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@repo/database'

// POST /api/schedules/reorder - Reorder jobs within a date/department
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const membership = await db.membership.findFirst({
      where: { userId: session.user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 403 })
    }

    const body = await request.json()
    const { scheduleId, newPosition, newDate, newDepartmentId, newEquipmentId } = body

    if (!scheduleId || newPosition === undefined) {
      return NextResponse.json(
        { error: 'scheduleId and newPosition are required' },
        { status: 400 }
      )
    }

    // Get the schedule being moved
    const schedule = await db.jobSchedule.findFirst({
      where: {
        id: scheduleId,
        tenantId: membership.tenantId,
      },
    })

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    const oldDate = schedule.scheduledDate
    const oldPosition = schedule.position
    const oldDepartmentId = schedule.departmentId
    const oldEquipmentId = schedule.equipmentId

    const targetDate = newDate ? new Date(newDate) : oldDate
    const targetDepartmentId = newDepartmentId || oldDepartmentId
    const targetEquipmentId = newEquipmentId !== undefined ? newEquipmentId : oldEquipmentId

    // Case 1: Moving within same date/department/equipment - just reorder
    if (
      oldDate.getTime() === targetDate.getTime() &&
      oldDepartmentId === targetDepartmentId &&
      oldEquipmentId === targetEquipmentId
    ) {
      // Get all schedules for this date/department/equipment
      const schedules = await db.jobSchedule.findMany({
        where: {
          departmentId: oldDepartmentId,
          equipmentId: oldEquipmentId,
          scheduledDate: oldDate,
          tenantId: membership.tenantId,
        },
        orderBy: {
          position: 'asc',
        },
      })

      // Remove the moving schedule from array
      const filteredSchedules = schedules.filter((s: typeof schedules[number]) => s.id !== scheduleId)

      // Insert at new position
      filteredSchedules.splice(newPosition - 1, 0, schedule)

      // Update all positions
      for (let i = 0; i < filteredSchedules.length; i++) {
        await db.jobSchedule.update({
          where: { id: filteredSchedules[i].id },
          data: { position: i + 1, updatedAt: new Date() },
        })
      }
    }
    // Case 2: Moving to different date, department, or equipment
    else {
      // Update positions in old date/department/equipment (close the gap)
      const oldSchedules = await db.jobSchedule.findMany({
        where: {
          departmentId: oldDepartmentId,
          equipmentId: oldEquipmentId,
          scheduledDate: oldDate,
          tenantId: membership.tenantId,
          position: { gt: oldPosition },
        },
        orderBy: {
          position: 'asc',
        },
      })

      for (const s of oldSchedules) {
        await db.jobSchedule.update({
          where: { id: s.id },
          data: { position: s.position - 1, updatedAt: new Date() },
        })
      }

      // Get schedules in new date/department/equipment
      const newSchedules = await db.jobSchedule.findMany({
        where: {
          departmentId: targetDepartmentId,
          equipmentId: targetEquipmentId,
          scheduledDate: targetDate,
          tenantId: membership.tenantId,
        },
        orderBy: {
          position: 'asc',
        },
      })

      // Make room at new position
      for (const s of newSchedules) {
        if (s.position >= newPosition) {
          await db.jobSchedule.update({
            where: { id: s.id },
            data: { position: s.position + 1, updatedAt: new Date() },
          })
        }
      }

      // Move the schedule to new date/department/equipment/position
      await db.jobSchedule.update({
        where: { id: scheduleId },
        data: {
          scheduledDate: targetDate,
          departmentId: targetDepartmentId,
          equipmentId: targetEquipmentId,
          position: newPosition,
          updatedAt: new Date(),
        },
      })
    }

    // Return updated schedule
    const updatedSchedule = await db.jobSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        Department: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        Equipment: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedSchedule,
    })
  } catch (error) {
    console.error('Reorder schedule error:', error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
