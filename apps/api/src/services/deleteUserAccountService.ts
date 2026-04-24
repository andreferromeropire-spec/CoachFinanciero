import { prisma } from "@coach/db";

/**
 * Borra todos los datos de un usuario y luego el registro de User.
 * Mismo orden que en SQL crudo: hijos con FK a User/Account/Budget/Conversation/Transaction.
 */
export async function deleteAllUserData(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.message.deleteMany({
      where: { conversation: { userId } },
    });
    await tx.conversation.deleteMany({ where: { userId } });
    await tx.emailIngest.deleteMany({ where: { userId } });
    await tx.transaction.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.budgetCategory.deleteMany({
      where: { budget: { userId } },
    });
    await tx.budget.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.connectedEmail.deleteMany({ where: { userId } });
    await tx.userSettings.deleteMany({ where: { userId } });
    await tx.refreshToken.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });
}
