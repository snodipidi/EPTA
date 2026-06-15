/**
 * Seed script — provisions a realistic dataset that mirrors the frontend mock
 * data (frontend/src/data/*). Running this and pointing the frontend at the API
 * (VITE_USE_MOCK=false) yields the same content the mocks show, so the switch
 * from mock → live is visually seamless.
 *
 * Idempotent: uses upserts keyed by username/email, safe to re-run.
 */
import {
  PrismaClient,
  ProfileVisibility,
  ReactionType,
  SubscriptionTier,
  UserRole,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Password123!';

interface SeedUser {
  username: string;
  displayName: string;
  email: string;
  bio?: string;
  role?: UserRole;
  reputation: number;
}

// Mirrors mockProfile / mockTopUsers / mockPosts authors.
const USERS: SeedUser[] = [
  {
    username: 'snodipidi',
    displayName: 'снодипиди',
    email: 'snodipidi@epta.dev',
    bio: 'ыыыы вайбкодинг',
    role: UserRole.OWNER,
    reputation: 320,
  },
  {
    username: 'ego_yuz',
    displayName: 'Кто-то там',
    email: 'ego_yuz@epta.dev',
    reputation: 1488,
  },
  {
    username: 'userrr',
    displayName: 'Ещё кто-то',
    email: 'userrr@epta.dev',
    reputation: 980,
  },
  {
    username: 'sixseven',
    displayName: 'Киршик',
    email: 'sixseven@epta.dev',
    reputation: 767,
  },
  {
    username: 'bebebe',
    displayName: 'хз',
    email: 'bebebe@epta.dev',
    reputation: 420,
  },
  {
    username: 'comment_guy',
    displayName: 'Комментатор',
    email: 'comment_guy@epta.dev',
    reputation: 50,
  },
  {
    username: 'another_one',
    displayName: 'другой дауж',
    email: 'another_one@epta.dev',
    reputation: 30,
  },
];

async function main(): Promise<void> {
  console.log('🌱 Seeding EPTA database...');
  const passwordHash = await argon2.hash(DEFAULT_PASSWORD);

  // ── Users + profiles + subscriptions ──
  const userByName = new Map<string, string>();
  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        email: u.email,
        username: u.username,
        passwordHash,
        role: u.role ?? UserRole.USER,
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            displayName: u.displayName,
            bio: u.bio,
            visibility: ProfileVisibility.PUBLIC,
            reputationScore: u.reputation,
          },
        },
        subscription: {
          create: {
            tier:
              u.username === 'snodipidi'
                ? SubscriptionTier.VIP
                : SubscriptionTier.FREE,
          },
        },
      },
    });
    userByName.set(u.username, user.id);
  }
  console.log(`  ✓ ${USERS.length} users`);

  const id = (name: string): string => {
    const v = userByName.get(name);
    if (!v) throw new Error(`Unknown seed user: ${name}`);
    return v;
  };

  // ── Follow graph (gives snodipidi a populated following-feed) ──
  const follows: Array<[string, string]> = [
    ['snodipidi', 'ego_yuz'],
    ['snodipidi', 'userrr'],
    ['ego_yuz', 'snodipidi'],
    ['userrr', 'snodipidi'],
    ['sixseven', 'snodipidi'],
    ['bebebe', 'ego_yuz'],
  ];
  for (const [follower, following] of follows) {
    await prisma.follow.upsert({
      where: {
        followerId_followingId: {
          followerId: id(follower),
          followingId: id(following),
        },
      },
      update: {},
      create: { followerId: id(follower), followingId: id(following) },
    });
  }
  // Recompute follower/following counters from the graph we just built.
  for (const name of userByName.keys()) {
    const [followers, followingCount] = await Promise.all([
      prisma.follow.count({ where: { followingId: id(name) } }),
      prisma.follow.count({ where: { followerId: id(name) } }),
    ]);
    await prisma.profile.update({
      where: { userId: id(name) },
      data: { followersCount: followers, followingCount },
    });
  }
  console.log(`  ✓ ${follows.length} follow edges`);

  // ── Posts (mirrors mockPosts) ──
  // Wipe existing seed posts so re-runs don't duplicate (posts have no natural key).
  await prisma.post.deleteMany({
    where: { author: { username: { in: USERS.map((u) => u.username) } } },
  });

  const post1 = await prisma.post.create({
    data: {
      authorId: id('ego_yuz'),
      text: 'Сам пост бла бла блаблаблаблабла',
      hashtags: ['теги'],
      publishedAt: new Date('2026-06-09T10:30:00Z'),
    },
  });
  const post2 = await prisma.post.create({
    data: {
      authorId: id('userrr'),
      text: 'ыыыыы 42',
      hashtags: ['епта', 'тест'],
      publishedAt: new Date('2026-06-09T09:15:00Z'),
    },
  });
  await prisma.post.create({
    data: {
      authorId: id('snodipidi'),
      text: 'пуки каки',
      hashtags: ['епта'],
      publishedAt: new Date('2026-06-08T18:00:00Z'),
    },
  });
  await prisma.post.create({
    data: {
      authorId: id('snodipidi'),
      text: 'жмишер в туре пятерка и еще один исполнитель',
      hashtags: [],
      publishedAt: new Date('2026-06-07T14:20:00Z'),
    },
  });
  console.log('  ✓ 4 posts');

  // ── Comments (mirrors mockComments) ──
  await prisma.comment.createMany({
    data: [
      {
        postId: post1.id,
        authorId: id('comment_guy'),
        text: 'бебебебе',
        createdAt: new Date('2026-06-09T11:00:00Z'),
      },
      {
        postId: post1.id,
        authorId: id('another_one'),
        text: 'оооооооооочень круто',
        createdAt: new Date('2026-06-09T11:30:00Z'),
      },
      {
        postId: post2.id,
        authorId: id('ego_yuz'),
        text: '42',
        createdAt: new Date('2026-06-09T09:45:00Z'),
      },
    ],
  });

  // ── Some reactions so counters are non-zero ──
  const likers = ['snodipidi', 'userrr', 'sixseven', 'bebebe'];
  for (const liker of likers) {
    await prisma.reaction.upsert({
      where: { userId_postId: { userId: id(liker), postId: post1.id } },
      update: {},
      create: { userId: id(liker), postId: post1.id, type: ReactionType.LIKE },
    });
  }

  // ── Reconcile post counters from source-of-truth rows ──
  for (const p of await prisma.post.findMany({ select: { id: true } })) {
    const [likes, comments, reposts] = await Promise.all([
      prisma.reaction.count({ where: { postId: p.id } }),
      prisma.comment.count({ where: { postId: p.id, deletedAt: null } }),
      prisma.post.count({ where: { parentPostId: p.id } }),
    ]);
    await prisma.post.update({
      where: { id: p.id },
      data: { likesCount: likes, commentsCount: comments, repostsCount: reposts },
    });
  }
  console.log('  ✓ comments + reactions + reconciled counters');

  console.log(
    `\n✅ Seed complete. Login with any seeded email and password "${DEFAULT_PASSWORD}".`,
  );
  console.log('   e.g. snodipidi@epta.dev / Password123!  (role: OWNER, VIP)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
