import { Context, Schema } from "koishi";
import {} from "@koishijs/cache";

export const name = "maimai-queue-board";
export const inject = ["cache"];

export interface Config {}

export const Config: Schema<Config> = Schema.object({});

/**
 * Calculate `maxAge` for a cache entry.
 * @returns Proper age of the cache entry
 */
function getAge(): number {
  const currentTime = Date.now();

  const tomorrow = new Date(currentTime + 24 * 60 * 60 * 1000);
  tomorrow.setHours(3, 0, 0, 0);
  const tomorrowTime = tomorrow.getTime();

  return tomorrowTime - currentTime;
}

interface Card {
  uid: string;
  name: string;
}

interface RevCard {
  table: `maimai_queue_${string}`;
  arcade: string;
}

declare module "@koishijs/cache" {
  interface Tables {
    [key: `maimai_queue_${string}`]: Card[];
    maimai_rev_queue: RevCard;
  }
}

export function apply(ctx: Context) {
  ctx.i18n.define("zh-CN", require("./locales/zh-CN"));

  ctx
    .command("maiqueue.attend <arcade:string>")
    .action(async ({ session }, arcade) => {
      if (!session.guildId)
        return <i18n path="commands.maiqueue.messages.pleaseUseInGuilds" />;
      if (!arcade) return <i18n path=".pleaseProvideArcade" />;

      // Check if user already in a queue
      if (await ctx.cache.get("maimai_rev_queue", session.uid))
        return <i18n path=".alreadyInQueue" />;

      // Get current queue
      let queue = await ctx.cache.get(`maimai_queue_${session.gid}`, arcade);
      if (!queue) queue = [];

      // Add user and save queue
      queue.push({
        uid: session.uid,
        name: session.username,
      });
      await ctx.cache.set(
        `maimai_queue_${session.gid}`,
        arcade,
        queue,
        getAge()
      );
      await ctx.cache.set(
        "maimai_rev_queue",
        session.uid,
        {
          table: `maimai_queue_${session.gid}`,
          arcade,
        },
        getAge()
      );

      return (
        <>
          <p>
            <i18n path=".success">
              <>{arcade}</>
              <>{queue.length}</>
            </i18n>
          </p>
          <p>
            <i18n path="commands.maiqueue.messages.currentQueue" />
          </p>
          {queue.map((card) => (
            <p>
              {card.name}
              <br />
            </p>
          ))}
        </>
      );
    });

  ctx.command("maiqueue.leave").action(async ({ session }) => {
    if (!session.guildId)
      return <i18n path="commands.maiqueue.messages.pleaseUseInGuilds" />;

    // Check if user already in a queue
    const revCard = await ctx.cache.get("maimai_rev_queue", session.uid);
    if (!revCard) return <i18n path=".notInQueue" />;

    // Check if guild is right
    let queue = await ctx.cache.get(
      `maimai_queue_${session.gid}`,
      revCard.arcade
    );
    if (!queue)
      return (
        <i18n path="commands.maiqueue.messages.queueNotExist">
          {revCard.arcade}
        </i18n>
      );

    // Remove the user and save queue
    queue = queue.filter((card) => card.uid != session.uid);
    if (queue.length === 0) {
      await ctx.cache.delete(revCard.table, revCard.arcade);
    } else {
      await ctx.cache.set(revCard.table, revCard.arcade, queue, getAge());
    }
    await ctx.cache.delete("maimai_rev_queue", session.uid);

    return (
      <>
        <p>
          <i18n path=".success">
            <>{revCard.arcade}</>
            <>{queue.length}</>
          </i18n>
        </p>
        {queue.length === 0 ? (
          ""
        ) : (
          <>
            <p>
              <i18n path="commands.maiqueue.messages.currentQueue" />
            </p>
            {queue.map((card) => (
              <p>{card.name}</p>
            ))}
          </>
        )}
      </>
    );
  });

  ctx
    .command("maiqueue.list [arcade:string]")
    .action(async ({ session }, arcade) => {
      if (!session.guildId)
        return <i18n path="commands.maiqueue.messages.pleaseUseInGuilds" />;

      if (!arcade)
        arcade = (await ctx.cache.get("maimai_rev_queue", session.uid))?.arcade;
      if (!arcade) return <i18n path=".notInQueue" />;

      const queue = await ctx.cache.get(`maimai_queue_${session.gid}`, arcade);
      if (!queue)
        return (
          <i18n path="commands.maiqueue.messages.queueNotExist">{arcade}</i18n>
        );

      return (
        <>
          <p>
            <i18n path="commands.maiqueue.messages.currentQueue" />
          </p>
          {queue.map((card) => (
            <p>{card.name}</p>
          ))}
        </>
      );
    });

  ctx.command("maiqueue.on").action(async ({ session }) => {
    if (!session.guildId)
      return <i18n path="commands.maiqueue.messages.pleaseUseInGuilds" />;

    // Check if user already in a queue
    const revCard = await ctx.cache.get("maimai_rev_queue", session.uid);
    if (!revCard) return <i18n path=".notInQueue" />;

    // Check if guild is right
    const queue = await ctx.cache.get(
      `maimai_queue_${session.gid}`,
      revCard.arcade
    );
    if (!queue)
      return (
        <i18n path="commands.maiqueue.messages.queueNotExist">
          {revCard.arcade}
        </i18n>
      );

    // Check if the user is first
    if (queue[0].uid !== session.uid) return <i18n path=".notYourTurn" />;

    // Edit and save queue
    queue.push(queue.shift());
    await ctx.cache.set(revCard.table, revCard.arcade, queue, getAge());
    return (
      <>
        <p>
          <i18n path=".success">
            <>{revCard.arcade}</>
            <>{queue.length}</>
          </i18n>
        </p>
        <p>
          <i18n path="commands.maiqueue.messages.currentQueue" />
        </p>
        {queue.map((card) => (
          <p>
            {card.name}
            <br />
          </p>
        ))}
      </>
    );
  });
}
