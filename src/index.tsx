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
  tomorrow.setHours(4, 0, 0, 0);
  const tomorrowTime = tomorrow.getTime();

  return tomorrowTime - currentTime;
}

interface Card {
  uid: string;
  name: string;
}

declare module "@koishijs/cache" {
  interface Tables {
    [key: `maimai_queue_${string}`]: Card[];
    maimai_rev_queue: string;
  }
}

export function apply(ctx: Context) {
  ctx.i18n.define("zh-CN", require("./locales/zh-CN"));

  const baseCommand = ctx.command("maiqueue");

  baseCommand
    .subcommand(".attend <arcade:string>")
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
      await ctx.cache.set("maimai_rev_queue", session.uid, arcade, getAge());

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
            <p>{card.name}</p>
          ))}
        </>
      );
    });

  baseCommand.subcommand(".leave").action(async ({ session }) => {
    if (!session.guildId)
      return <i18n path="commands.maiqueue.messages.pleaseUseInGuilds" />;

    // Check if user already in a queue
    const arcade = await ctx.cache.get("maimai_rev_queue", session.uid);
    if (!arcade) return <i18n path=".notInQueue" />;

    // Check if guild is right
    let queue = await ctx.cache.get(`maimai_queue_${session.gid}`, arcade);
    if (!queue)
      return (
        <i18n path="commands.maiqueue.messages.queueNotExist">{arcade}</i18n>
      );

    // Remove the user and save queue
    queue = queue.filter((card) => card.uid != session.uid);
    if (queue.length === 0) {
      await ctx.cache.delete(`maimai_queue_${session.gid}`, arcade);
    } else {
      await ctx.cache.set(
        `maimai_queue_${session.gid}`,
        arcade,
        queue,
        getAge()
      );
    }
    await ctx.cache.delete("maimai_rev_queue", session.uid);

    return (
      <>
        <p>
          <i18n path=".success">
            <>{arcade}</>
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

  baseCommand
    .subcommand(".list [arcade:string]")
    .action(async ({ session }, arcade) => {
      if (!session.guildId)
        return <i18n path="commands.maiqueue.messages.pleaseUseInGuilds" />;

      if (!arcade)
        arcade = await ctx.cache.get("maimai_rev_queue", session.uid);
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

  baseCommand.subcommand(".on").action(async ({ session }) => {
    if (!session.guildId)
      return <i18n path="commands.maiqueue.messages.pleaseUseInGuilds" />;

    // Check if user already in a queue
    const arcade = await ctx.cache.get("maimai_rev_queue", session.uid);
    if (!arcade) return <i18n path=".notInQueue" />;

    // Check if guild is right
    const queue = await ctx.cache.get(`maimai_queue_${session.gid}`, arcade);
    if (!queue)
      return (
        <i18n path="commands.maiqueue.messages.queueNotExist">{arcade}</i18n>
      );

    // Check if the user is first
    if (queue[0].uid !== session.uid) return <i18n path=".notYourTurn" />;

    // Edit and save queue
    queue.push(queue.shift());
    await ctx.cache.set(`maimai_queue_${session.gid}`, arcade, queue, getAge());
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
          <p>{card.name}</p>
        ))}
      </>
    );
  });

  baseCommand
    .subcommand(".force-on <arcade:string>", { authority: 2 })
    .action(async ({ session }, arcade) => {
      if (!session.guildId)
        return <i18n path="commands.maiqueue.messages.pleaseUseInGuilds" />;
      if (!arcade) return <i18n path=".pleaseProvideArcade" />;

      // Check if guild is right
      const queue = await ctx.cache.get(`maimai_queue_${session.gid}`, arcade);
      if (!queue)
        return (
          <i18n path="commands.maiqueue.messages.queueNotExist">{arcade}</i18n>
        );

      // Edit and save queue
      queue.push(queue.shift());
      await ctx.cache.set(
        `maimai_queue_${session.gid}`,
        arcade,
        queue,
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
            <p>{card.name}</p>
          ))}
        </>
      );
    });

  baseCommand
    .subcommand(".force-leave <arcade:string>", { authority: 2 })
    .action(async ({ session }, arcade) => {
      if (!session.guildId)
        return <i18n path="commands.maiqueue.messages.pleaseUseInGuilds" />;
      if (!arcade) return <i18n path=".pleaseProvideArcade" />;

      // Check if guild is right
      const queue = await ctx.cache.get(`maimai_queue_${session.gid}`, arcade);
      if (!queue)
        return (
          <i18n path="commands.maiqueue.messages.queueNotExist">{arcade}</i18n>
        );

      // Remove the user and save queue
      const removing = queue.shift();
      if (queue.length === 0) {
        await ctx.cache.delete(`maimai_queue_${session.gid}`, arcade);
      } else {
        await ctx.cache.set(
          `maimai_queue_${session.gid}`,
          arcade,
          queue,
          getAge()
        );
      }
      await ctx.cache.delete("maimai_rev_queue", removing.uid);

      return (
        <>
          <p>
            <i18n path=".success">
              <>{arcade}</>
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
}
