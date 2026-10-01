import { createAndEmitNotification } from './notificationService';

type NotificationKind = 'bid_placed' | 'outbid' | 'auction_closed' | 'auction_forfeited';

type AuctionNotificationInput = {
  auctionItemId: number;
  sellerId?: number | null;
  winnerId?: number | null;
  bidderId?: number | null;
  amount?: number | null;
  currency?: string | null;
  paymentCompleted?: boolean;
};

function addUserId(target: Set<number>, value: unknown) {
  const id = Number(value);
  if (Number.isInteger(id) && id > 0) target.add(id);
}

async function getBidderIds(strapi: any, auctionItemId: number) {
  const bids = await strapi.db.query('api::bid.bid').findMany({
    where: { auctionItem: auctionItemId },
    populate: { bidder: { select: ['id'] } },
  });

  const bidderIds = new Set<number>();
  for (const bid of bids) addUserId(bidderIds, bid.bidder?.id ?? bid.bidder);
  return bidderIds;
}

function send(strapi: any, userId: number, kind: NotificationKind, input: AuctionNotificationInput, title: string, body: string) {
  return createAndEmitNotification(strapi, userId, {
    title,
    body,
    data: {
      kind,
      auctionItemId: input.auctionItemId,
      winnerId: input.winnerId ?? null,
      bidderId: input.bidderId ?? null,
      amount: input.amount ?? null,
      currency: input.currency ?? null,
    },
  });
}

export async function notifyBidPlaced(strapi: any, input: AuctionNotificationInput) {
  const bidderIds = await getBidderIds(strapi, input.auctionItemId);
  const recipients = new Set(bidderIds);
  addUserId(recipients, input.sellerId);
  addUserId(recipients, input.bidderId);

  for (const userId of recipients) {
    if (userId === Number(input.sellerId)) {
      await send(strapi, userId, 'bid_placed', input, 'New bid received', 'A new bid was placed on your auction.');
    } else if (userId === Number(input.bidderId)) {
      await send(strapi, userId, 'bid_placed', input, 'Bid placed', 'Your bid was placed successfully.');
    } else {
      await send(strapi, userId, 'outbid', input, 'New bid on an auction you joined', 'Another bidder placed a new bid.');
    }
  }
}

export async function notifyAuctionClosed(strapi: any, input: AuctionNotificationInput) {
  const bidderIds = await getBidderIds(strapi, input.auctionItemId);
  const recipients = new Set(bidderIds);
  addUserId(recipients, input.sellerId);

  for (const userId of recipients) {
    if (userId === Number(input.sellerId)) {
      await send(strapi, userId, 'auction_closed', input, 'Auction ended', 'Your auction has ended.');
    } else if (userId === Number(input.winnerId)) {
      await send(
        strapi,
        userId,
        'auction_closed',
        input,
        'You won the auction',
        input.paymentCompleted
          ? 'Your locked bid deposit covered the purchase. Your item is awaiting delivery.'
          : 'You won this auction. Complete payment to continue.'
      );
    } else {
      await send(strapi, userId, 'auction_closed', input, 'Auction ended', 'The auction ended with another winning bidder.');
    }
  }
}

export async function notifyAuctionForfeited(strapi: any, input: AuctionNotificationInput) {
  const bidderIds = await getBidderIds(strapi, input.auctionItemId);
  const recipients = new Set(bidderIds);
  addUserId(recipients, input.sellerId);

  for (const userId of recipients) {
    if (userId === Number(input.winnerId)) {
      await send(strapi, userId, 'auction_forfeited', input, 'Auction payment expired', 'Your winning bid was forfeited because payment was not completed.');
    } else if (userId === Number(input.sellerId)) {
      await send(strapi, userId, 'auction_forfeited', input, 'Winning bid forfeited', 'The winning bidder did not complete payment.');
    } else {
      await send(strapi, userId, 'auction_forfeited', input, 'Auction updated', 'The winning bid was forfeited.');
    }
  }
}
