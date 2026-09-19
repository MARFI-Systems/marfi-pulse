import Email from "Common/Types/Email";
import BadDataException from "Common/Types/Exception/BadDataException";
import { JSONObject } from "Common/Types/JSON";
import UserService from "Common/Server/Services/UserService";
import UserSessionService, {
  SessionMetadata,
} from "Common/Server/Services/UserSessionService";
import CookieUtil from "Common/Server/Utils/Cookie";
import JSONWebToken from "Common/Server/Utils/JsonWebToken";
import Express, {
  ExpressRequest,
  ExpressResponse,
  ExpressRouter,
  NextFunction,
  extractDeviceInfo,
  getClientIp,
  headerValueToString,
} from "Common/Server/Utils/Express";
import Response from "Common/Server/Utils/Response";
import IdentityRateLimit, {
  IdentityRateLimitBucket,
} from "Common/Server/Middleware/IdentityRateLimit";
import User from "Common/Models/DatabaseModels/User";

const router: ExpressRouter = Express.getRouter();

const HEXCLAVE_API_ORIGIN: string = "https://apigcp.hexclave.com";
const ACCESS_TOKEN_EXPIRY_SECONDS: number = 15 * 60;
const MAX_TOKEN_BYTES: number = 8192;
const ALLOWED_EMAIL_DOMAIN: string = "marfi.io";

const isHexclaveEnabled: boolean =
  (process.env["HEXCLAVE_ENABLED"] || "").toLowerCase() === "true";

const hexclaveRateLimit: (
  req: ExpressRequest,
  res: ExpressResponse,
  next: NextFunction,
) => Promise<void> = IdentityRateLimit.getMiddleware(
  IdentityRateLimitBucket.Login,
);

const isMarfiEmail: (value: string) => boolean = (value: string): boolean => {
  const at: number = value.lastIndexOf("@");
  if (at <= 0) {
    return false;
  }
  return value.slice(at + 1).toLowerCase() === ALLOWED_EMAIL_DOMAIN;
};

const bearerToken: (req: ExpressRequest) => string = (
  req: ExpressRequest,
): string => {
  const header: string = (req.headers["authorization"] || "").toString();
  const match: RegExpMatchArray | null = header.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1]! : "";
};

router.post(
  "/hexclave/exchange",
  hexclaveRateLimit,
  async (
    req: ExpressRequest,
    res: ExpressResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!isHexclaveEnabled) {
        throw new BadDataException("Sign-in was not accepted.");
      }

      const projectId: string = process.env["HEXCLAVE_PROJECT_ID"] || "";
      const publishableClientKey: string =
        process.env["HEXCLAVE_PUBLISHABLE_CLIENT_KEY"] || "";
      if (!projectId || !publishableClientKey) {
        throw new BadDataException("Sign-in was not accepted.");
      }

      const bodyToken: string =
        typeof req.body === "object" && req.body
          ? String((req.body as JSONObject)["accessToken"] || "")
          : "";
      const accessToken: string = bearerToken(req) || bodyToken;
      if (!accessToken || accessToken.length > MAX_TOKEN_BYTES) {
        throw new BadDataException("Sign-in was not accepted.");
      }

      const providerResponse: globalThis.Response = await fetch(
        `${HEXCLAVE_API_ORIGIN}/api/v1/users/me`,
        {
          method: "GET",
          headers: {
            "X-Hexclave-Access-Type": "client",
            "X-Hexclave-Project-Id": projectId,
            "X-Hexclave-Publishable-Client-Key": publishableClientKey,
            "X-Hexclave-Access-Token": accessToken,
          },
        },
      );

      if (!providerResponse.ok) {
        throw new BadDataException("Sign-in was not accepted.");
      }

      const payload: JSONObject = (await providerResponse.json()) as JSONObject;
      const nestedUser: JSONObject =
        (payload["user"] as JSONObject) || payload;
      const providerEmailRaw: string = (
        (nestedUser["primary_email"] as string) ||
        (nestedUser["primaryEmail"] as string) ||
        (nestedUser["email"] as string) ||
        (payload["primary_email"] as string) ||
        (payload["primaryEmail"] as string) ||
        ""
      )
        .trim()
        .toLowerCase();

      if (!isMarfiEmail(providerEmailRaw)) {
        throw new BadDataException("Sign-in was not accepted.");
      }

      const user: User | null = await UserService.findOneBy({
        query: {
          email: new Email(providerEmailRaw),
        },
        select: {
          _id: true,
          email: true,
          name: true,
          isMasterAdmin: true,
          timezone: true,
        },
        props: {
          isRoot: true,
        },
      });

      if (!user || !user.id || !user.email) {
        throw new BadDataException("Sign-in was not accepted.");
      }

      const sessionMetadata: SessionMetadata =
        await UserSessionService.createSession({
          userId: user.id,
          isGlobalLogin: true,
          ipAddress: getClientIp(req),
          userAgent: headerValueToString(req.headers["user-agent"]),
          ...extractDeviceInfo(req),
        });

      CookieUtil.setUserCookie({
        expressResponse: res,
        user,
        isGlobalLogin: true,
        sessionId: sessionMetadata.session.id!,
        refreshToken: sessionMetadata.refreshToken,
        refreshTokenExpiresAt: sessionMetadata.refreshTokenExpiresAt,
        accessTokenExpiresInSeconds: ACCESS_TOKEN_EXPIRY_SECONDS,
      });

      const oneuptimeAccessToken: string = JSONWebToken.signUserLoginToken({
        tokenData: {
          userId: user.id,
          email: user.email,
          name: user.name!,
          timezone: user.timezone || null,
          isMasterAdmin: user.isMasterAdmin!,
          isGlobalLogin: true,
          sessionId: sessionMetadata.session.id!,
        },
        expiresInSeconds: ACCESS_TOKEN_EXPIRY_SECONDS,
      });

      return Response.sendJsonObjectResponse(req, res, {
        success: true,
        accessToken: oneuptimeAccessToken,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
