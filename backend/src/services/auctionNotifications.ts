import socketService from './socketService';

type NotificationKind = 'bid_placed' | 'outbid' | 'auction_closed' | 'auction_forfeited';

type AuctionNotificationInput = {
  auctionItemId: number;
  sellerId?: number | null;
  winnerId?: number | null;
  bidderId?: number | null;
  amount?: number | null;
  currency?: string | null;
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

function send(userId: number, kind: NotificationKind, input: AuctionNotificationInput, title: string, body: string) {
  socketService.emitNotification(userId, {
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

  for (const userId of recipients) {
    if (userId === Number(input.sellerId)) {
      send(userId, 'bid_placed', input, 'New bid received', 'A new bid was placed on your auction.');
    } else if (userId === Number(input.bidderId)) {
      send(userId, 'bid_placed', input, 'Bid placed', 'Your bid was placed successfully.');
    } else {
      send(userId, 'outbid', input, 'New bid on an auction you joined', 'Another bidder placed a new bid.');
    }
  }
}

export async function notifyAuctionClosed(strapi: any, input: AuctionNotificationInput) {
  const bidderIds = await getBidderIds(strapi, input.auctionItemId);
  const recipients = new Set(bidderIds);
  addUserId(recipients, input.sellerId);

  for (const userId of recipients) {
    if (userId === Number(input.sellerId)) {
      send(userId, 'auction_closed', input, 'Auction ended', 'Your auction has ended.');
    } else if (userId === Number(input.winnerId)) {
      send(userId, 'auction_closed', input, 'You won the auction', 'You won this auction. Complete payment to continue.');
    } else {
      send(userId, 'auction_closed', input, 'Auction ended', 'The auction ended with another winning bidder.');
    }
  }
}

export async function notifyAuctionForfeited(strapi: any, input: AuctionNotificationInput) {
  const bidderIds = await getBidderIds(strapi, input.auctionItemId);
  const recipients = new Set(bidderIds);
  addUserId(recipients, input.sellerId);

  for (const userId of recipients) {
    if (userId === Number(input.winnerId)) {
      send(userId, 'auction_forfeited', input, 'Auction payment expired', 'Your winning bid was forfeited because payment was not completed.');
    } else if (userId === Number(input.sellerId)) {
      send(userId, 'auction_forfeited', input, 'Winning bid forfeited', 'The winning bidder did not complete payment.');
    } else {
      send(userId, 'auction_forfeited', input, 'Auction updated', 'The winning bid was forfeited.');
    }
  }
}
