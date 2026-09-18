import { JSONObject } from "Common/Types/JSON";
import Express, {
  ExpressRequest,
  ExpressResponse,
  ExpressRouter,
  NextFunction,
} from "Common/Server/Utils/Express";
import Response from "Common/Server/Utils/Response";
import BadRequestException from "Common/Types/Exception/BadRequestException";

const router: ExpressRouter = Express.getRouter();

const isHexclaveEnabled: boolean =
  (process.env["HEXCLAVE_ENABLED"] || "").toLowerCase() === "true";

/*
 * MARFI Pulse Hexclave exchange.
 * Disabled unless HEXCLAVE_ENABLED=true on the host.
 * Does not create users. Bind existing OneUptime users by email after JWKS verify.
 */
router.post(
  "/hexclave/exchange",
  async (
    req: ExpressRequest,
    res: ExpressResponse,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!isHexclaveEnabled) {
        return Response.sendErrorResponse(
          req,
          res,
          new BadRequestException("Hexclave login is not enabled."),
        );
      }

      const body: JSONObject = (req.body || {}) as JSONObject;
      if (!body["accessToken"] && !body["idToken"]) {
        return Response.sendErrorResponse(
          req,
          res,
          new BadRequestException("Missing Hexclave token."),
        );
      }

      return Response.sendErrorResponse(
        req,
        res,
        new BadRequestException(
          "Hexclave exchange is not implemented yet. Native login still works.",
        ),
      );
    } catch (err) {
      next(err);
    }
  },
);

export default router;
