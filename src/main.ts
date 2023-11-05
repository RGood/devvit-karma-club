// Visit developers.reddit.com/docs to learn Devvit!

import { Devvit } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
});

const MODE_EXCL = "excl";
const MODE_CUMM = "cumm";
const MODE_BOTH = "both";

Devvit.addSettings([
  {
    name: "karma",
    type: "number",
    label: "Karma Required",
  },
  {
    name: "mode",
    type: "select",
    label: "Mode",
    multiSelect: false,
    defaultValue: [MODE_EXCL],
    options: [
      {
        label: "Exclusive",
        value: MODE_EXCL,
      },
      {
        label: "Cummulative",
        value: MODE_CUMM,
      },
      {
        label: "Both",
        value: MODE_BOTH,
      }
    ]
  },
  {
    name: "lt",
    type: "boolean",
    label: "Less than?",
  }
]);

Devvit.addTrigger({
  event: 'ModMail',
  onEvent: async (event, context) => {
    // Ignore self
    if(context.appAccountId === event.messageAuthor?.id) {
      return;
    }

    // Error if no message author
    if(!event.messageAuthor?.id) {
      throw new Error("No user ID somehow");
    }

    const user = await context.reddit.getUserById(event.messageAuthor.id);
    const subreddit = await context.reddit.getSubredditById(context.subredditId);

    // Ignore if already approved
    const approved = await subreddit.getApprovedUsers({
      username: user.username,
    }).all();

    if(approved.length > 0) {
      console.log(`User "${user.username}" already approved`);
      return;
    }

    const settings = await context.settings.getAll();

    const req: number = settings["karma"] as number | undefined || 0;
    const lt: boolean = settings["lt"] as boolean | undefined || false;
    const modes: string[] = settings["mode"] as string[] | undefined || ["excl"];

    if(modes.length != 1) {
      throw new Error("Mode must be set to exactly 1 value");
    }

    const mode = modes[0];

    let success = false;
    console.log(`User: ${user.username} (${user.linkKarma}, ${user.commentKarma})`);
    console.log(`Mode: ${mode}`);
    console.log(`Req:  ${lt ? '<' : '>='} ${req}`);

    switch(mode){
      case MODE_EXCL:
        success = (!lt == user.linkKarma >= req) || (!lt == user.commentKarma >= req);
        console.log(`Result: ${success}`);
        break;
      case MODE_CUMM:
        success = !lt == user.commentKarma + user.linkKarma >= req;
        console.log(`Result: ${success}`);
        break;
      case MODE_BOTH:
        success = (!lt == user.commentKarma >= req) && (!lt == user.linkKarma >= req);
        console.log(`Result: ${success}`);
        break;
      default:
        return
    }

    if(success) {
      await subreddit.approveUser(user.username);
      await context.reddit.modMail.reply({
        body: "You have been approved.",
        conversationId: event.conversationId,
      });
    } else {
      await context.reddit.modMail.reply({
        body: "You do not have enough karma.",
        conversationId: event.conversationId,
      });
    }

  }
});

export default Devvit;
