import { Router, Request, Response } from "express";
import { prisma } from "@coach/db";

export const notificationsRouter = Router();

notificationsRouter.get("/", async (_req: Request, res: Response) => {
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unreadCount = await prisma.notification.count({ where: { read: false } });
  res.json({ notifications, unreadCount });
});

notificationsRouter.patch("/:id/read", async (req: Request, res: Response) => {
  try {
    const n = await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true },
    });
    res.json(n);
  } catch {
    res.status(404).json({ error: "Notification not found" });
  }
});

notificationsRouter.post("/read-all", async (_req: Request, res: Response) => {
  await prisma.notification.updateMany({ where: { read: false }, data: { read: true } });
  res.sendStatus(204);
});
