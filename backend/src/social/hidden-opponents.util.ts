import type { PrismaService } from '../prisma/prisma.service';

/** Players to hide from social discovery when either side blocked the other. */
export async function hiddenOpponentIdsForViewer(
  prisma: PrismaService,
  viewerId: string,
): Promise<Set<string>> {
  const [outgoing, incoming] = await Promise.all([
    prisma.playerBlock.findMany({
      where: { blockerId: viewerId },
      select: { blockedId: true },
    }),
    prisma.playerBlock.findMany({
      where: { blockedId: viewerId },
      select: { blockerId: true },
    }),
  ]);
  return new Set([
    ...outgoing.map((r) => r.blockedId),
    ...incoming.map((r) => r.blockerId),
  ]);
}

export async function isEitherBlocked(
  prisma: PrismaService,
  aId: string,
  bId: string,
): Promise<boolean> {
  const row = await prisma.playerBlock.findFirst({
    where: {
      OR: [
        { blockerId: aId, blockedId: bId },
        { blockerId: bId, blockedId: aId },
      ],
    },
    select: { blockerId: true },
  });
  return !!row;
}
