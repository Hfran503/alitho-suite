--
-- PostgreSQL database dump
--

\restrict MXDfuDxe3wx33lkjdE463tsuIcebzOp48KKCWXLO8Xq5PRim4maRfVXF7puBAAB

-- Dumped from database version 17.5 (6bc9ef8)
-- Dumped by pg_dump version 17.6 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: neondb_owner
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO neondb_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: neondb_owner
--

COMMENT ON SCHEMA public IS '';


--
-- Name: BatchImportStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."BatchImportStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'COMPLETE',
    'CANCELLED'
);


ALTER TYPE public."BatchImportStatus" OWNER TO neondb_owner;

--
-- Name: BatchRowStatus; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public."BatchRowStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'SUCCESS',
    'FAILED',
    'CANCELLED'
);


ALTER TYPE public."BatchRowStatus" OWNER TO neondb_owner;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Account; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Account" (
    id text NOT NULL,
    "userId" text NOT NULL,
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at integer,
    token_type text,
    scope text,
    id_token text,
    session_state text
);


ALTER TABLE public."Account" OWNER TO neondb_owner;

--
-- Name: Attachment; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Attachment" (
    id text NOT NULL,
    filename text NOT NULL,
    "mimeType" text NOT NULL,
    size integer NOT NULL,
    bucket text NOT NULL,
    key text NOT NULL,
    url text,
    metadata jsonb,
    "tenantId" text NOT NULL,
    "orderId" text,
    "uploadedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Attachment" OWNER TO neondb_owner;

--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    action text NOT NULL,
    "entityType" text NOT NULL,
    "entityId" text,
    "userId" text,
    "actorName" text,
    "actorEmail" text,
    "ipAddress" text,
    "userAgent" text,
    metadata jsonb,
    "tenantId" text NOT NULL,
    "orderId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."AuditLog" OWNER TO neondb_owner;

--
-- Name: BatchImport; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."BatchImport" (
    id text NOT NULL,
    "fileName" text NOT NULL,
    "fileUrl" text,
    "sheetName" text,
    status public."BatchImportStatus" DEFAULT 'PENDING'::public."BatchImportStatus" NOT NULL,
    "totalRows" integer DEFAULT 0 NOT NULL,
    "processedRows" integer DEFAULT 0 NOT NULL,
    "successfulRows" integer DEFAULT 0 NOT NULL,
    "failedRows" integer DEFAULT 0 NOT NULL,
    "carrierId" text,
    "carrierCode" text,
    "serviceCode" text,
    carrier text,
    service text,
    "billToParty" text DEFAULT 'sender'::text NOT NULL,
    "billToAccount" text,
    "billToCountryCode" text DEFAULT 'US'::text NOT NULL,
    "billToPostalCode" text,
    "containsAlcohol" boolean DEFAULT false NOT NULL,
    "saturdayDelivery" boolean DEFAULT false NOT NULL,
    confirmation text DEFAULT 'none'::text NOT NULL,
    "notificationsEmail" text,
    "fromAddress" jsonb,
    "columnMapping" jsonb,
    "tenantId" text NOT NULL,
    "createdBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "startedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone
);


ALTER TABLE public."BatchImport" OWNER TO neondb_owner;

--
-- Name: BatchImportMapping; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."BatchImportMapping" (
    id text NOT NULL,
    "userId" text,
    "tenantId" text,
    "mappingName" text NOT NULL,
    "columnMappings" jsonb NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."BatchImportMapping" OWNER TO neondb_owner;

--
-- Name: BatchImportRow; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."BatchImportRow" (
    id text NOT NULL,
    "batchImportId" text NOT NULL,
    "rowNumber" integer NOT NULL,
    status public."BatchRowStatus" DEFAULT 'PENDING'::public."BatchRowStatus" NOT NULL,
    "groupKey" text,
    "shipDate" timestamp(3) without time zone,
    "jobNumber" text,
    "totalPackages" integer,
    "packageNumber" integer,
    "shipToName" text,
    "shipToCompany" text,
    "shipToAddress1" text,
    "shipToAddress2" text,
    "shipToCity" text,
    "shipToState" text,
    "shipToZip" text,
    "shipToCountry" text DEFAULT 'US'::text NOT NULL,
    "shipToPhone" text,
    weight double precision,
    length double precision,
    width double precision,
    height double precision,
    reference1 text,
    reference2 text,
    reference3 text,
    "itemNumber" text,
    "itemQuantity" integer,
    "trackingNumber" text,
    "trackingUrl" text,
    "labelUrl" text,
    "shippingCost" double precision,
    "errorMessage" text,
    notes text,
    "retryCount" integer DEFAULT 0 NOT NULL,
    "maxRetries" integer DEFAULT 3 NOT NULL,
    "lastAttemptAt" timestamp(3) without time zone,
    "isTransientError" boolean DEFAULT false NOT NULL,
    "paceJobShipmentId" integer,
    "paceCartonId" integer,
    "shipstationShipmentId" text,
    "shipstationLabelId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "processedAt" timestamp(3) without time zone
);


ALTER TABLE public."BatchImportRow" OWNER TO neondb_owner;

--
-- Name: CarrierServiceMapping; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."CarrierServiceMapping" (
    id text NOT NULL,
    "shipstationCarrierId" text NOT NULL,
    "shipstationCarrierCode" text NOT NULL,
    "shipstationServiceCode" text NOT NULL,
    "carrierName" text NOT NULL,
    "serviceName" text NOT NULL,
    "paceShipViaId" integer NOT NULL,
    "paceShipViaName" text NOT NULL,
    "tenantId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."CarrierServiceMapping" OWNER TO neondb_owner;

--
-- Name: Integration; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Integration" (
    id text NOT NULL,
    provider text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    config jsonb,
    "secretName" text,
    "tenantId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Integration" OWNER TO neondb_owner;

--
-- Name: InvoiceIntegration; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."InvoiceIntegration" (
    id text NOT NULL,
    "invoiceNumber" text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    payload jsonb NOT NULL,
    "netsuiteResponse" jsonb,
    "netsuiteInvoiceId" text,
    "errorMessage" text,
    "retryCount" integer DEFAULT 0 NOT NULL,
    "maxRetries" integer DEFAULT 3 NOT NULL,
    "lastAttemptAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "sentToNetsuiteAt" timestamp(3) without time zone,
    "tenantId" text NOT NULL
);


ALTER TABLE public."InvoiceIntegration" OWNER TO neondb_owner;

--
-- Name: Job; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Job" (
    id text NOT NULL,
    type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    payload jsonb,
    result jsonb,
    error text,
    progress integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "completedAt" timestamp(3) without time zone
);


ALTER TABLE public."Job" OWNER TO neondb_owner;

--
-- Name: Membership; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Membership" (
    id text NOT NULL,
    role text DEFAULT 'customer_service'::text NOT NULL,
    "userId" text NOT NULL,
    "tenantId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Membership" OWNER TO neondb_owner;

--
-- Name: MenuConfiguration; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."MenuConfiguration" (
    id text NOT NULL,
    "menuKey" text NOT NULL,
    label text NOT NULL,
    href text NOT NULL,
    icon text,
    "parentKey" text,
    "order" integer DEFAULT 0 NOT NULL,
    "visibleToRoles" text[],
    "isActive" boolean DEFAULT true NOT NULL,
    "tenantId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."MenuConfiguration" OWNER TO neondb_owner;

--
-- Name: NetSuiteIntegration; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."NetSuiteIntegration" (
    id text NOT NULL,
    "sandboxEnabled" boolean DEFAULT false NOT NULL,
    "productionEnabled" boolean DEFAULT false NOT NULL,
    "currentMode" text DEFAULT 'sandbox'::text NOT NULL,
    "tenantId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."NetSuiteIntegration" OWNER TO neondb_owner;

--
-- Name: Order; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Order" (
    id text NOT NULL,
    "orderNumber" text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "customerName" text NOT NULL,
    "customerEmail" text NOT NULL,
    "customerPhone" text,
    subtotal numeric(10,2) NOT NULL,
    tax numeric(10,2) NOT NULL,
    total numeric(10,2) NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    "shippingAddress" jsonb,
    "billingAddress" jsonb,
    notes text,
    metadata jsonb,
    "tenantId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Order" OWNER TO neondb_owner;

--
-- Name: OrderItem; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."OrderItem" (
    id text NOT NULL,
    sku text,
    name text NOT NULL,
    description text,
    quantity integer NOT NULL,
    "unitPrice" numeric(10,2) NOT NULL,
    total numeric(10,2) NOT NULL,
    metadata jsonb,
    "orderId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."OrderItem" OWNER TO neondb_owner;

--
-- Name: Session; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Session" OWNER TO neondb_owner;

--
-- Name: ShipmentTypeMapping; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ShipmentTypeMapping" (
    id text NOT NULL,
    "plannedTypeId" integer NOT NULL,
    "plannedTypeName" text NOT NULL,
    "completedTypeId" integer NOT NULL,
    "completedTypeName" text NOT NULL,
    "tenantId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ShipmentTypeMapping" OWNER TO neondb_owner;

--
-- Name: ShippingLabel; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."ShippingLabel" (
    id text NOT NULL,
    "paceShipmentId" integer,
    "paceCartonId" integer,
    provider text NOT NULL,
    "providerShipmentId" text,
    "providerLabelId" text,
    "trackingNumber" text NOT NULL,
    "labelUrl" text NOT NULL,
    "labelFormat" text,
    carrier text NOT NULL,
    service text NOT NULL,
    "shipFrom" jsonb NOT NULL,
    "shipTo" jsonb NOT NULL,
    weight numeric(10,2),
    length numeric(10,2),
    width numeric(10,2),
    height numeric(10,2),
    cost numeric(10,2) NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    "voidedAt" timestamp(3) without time zone,
    "refundedAt" timestamp(3) without time zone,
    "isReturnLabel" boolean DEFAULT false NOT NULL,
    "outboundLabelId" text,
    "rmaNumber" text,
    metadata jsonb,
    "tenantId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "lastTrackedAt" timestamp(3) without time zone,
    "trackingStatus" text
);


ALTER TABLE public."ShippingLabel" OWNER TO neondb_owner;

--
-- Name: Tenant; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."Tenant" (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    plan text DEFAULT 'free'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Tenant" OWNER TO neondb_owner;

--
-- Name: User; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    "emailVerified" timestamp(3) without time zone,
    name text,
    image text,
    password text,
    "passwordResetRequired" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."User" OWNER TO neondb_owner;

--
-- Name: VerificationToken; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."VerificationToken" (
    identifier text NOT NULL,
    token text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."VerificationToken" OWNER TO neondb_owner;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO neondb_owner;

--
-- Data for Name: Account; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Account" (id, "userId", type, provider, "providerAccountId", refresh_token, access_token, expires_at, token_type, scope, id_token, session_state) FROM stdin;
\.


--
-- Data for Name: Attachment; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Attachment" (id, filename, "mimeType", size, bucket, key, url, metadata, "tenantId", "orderId", "uploadedBy", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."AuditLog" (id, action, "entityType", "entityId", "userId", "actorName", "actorEmail", "ipAddress", "userAgent", metadata, "tenantId", "orderId", "createdAt") FROM stdin;
cmh1jin2h0004c5r64plea74e	user.created	user	cmh1jimiw0000c5r673dqamec	cmgzzeaa500011vtanifj1f2k	Hector Franco	hector.franco@calitho.com	\N	\N	{"role": "logistics", "userName": "Yemmy Chamulo-Perez", "userEmail": "yemmy.chamulo@calitho.com", "inviteSent": false, "temporaryPassword": false}	cmgzzea5200001vtaazq29pyk	\N	2025-10-22 05:15:58.409
cmh1jjptq0009c5r684ncym5y	user.created	user	cmh1jjpif0005c5r6jgsufdqx	cmgzzeaa500011vtanifj1f2k	Hector Franco	hector.franco@calitho.com	\N	\N	{"role": "logistics", "userName": "Amalia Erlin Alarcon", "userEmail": "Amalia.Alarcon@calitho.com", "inviteSent": false, "temporaryPassword": false}	cmgzzea5200001vtaazq29pyk	\N	2025-10-22 05:16:48.638
cmh1jkqz2000ec5r67wolysdv	user.created	user	cmh1jkqfh000ac5r60bkksx2u	cmgzzeaa500011vtanifj1f2k	Hector Franco	hector.franco@calitho.com	\N	\N	{"role": "admin", "userName": "Dhara Taheripour ", "userEmail": "dhara@calitho.com", "inviteSent": false, "temporaryPassword": false}	cmgzzea5200001vtaazq29pyk	\N	2025-10-22 05:17:36.783
cmh1jlfct000jc5r6s155co2k	user.created	user	cmh1jlf1d000fc5r6i4lkjlgk	cmgzzeaa500011vtanifj1f2k	Hector Franco	hector.franco@calitho.com	\N	\N	{"role": "admin", "userName": "Eric Matthews", "userEmail": "eric.matthews@calitho.com", "inviteSent": false, "temporaryPassword": false}	cmgzzea5200001vtaazq29pyk	\N	2025-10-22 05:18:08.382
cmh2854t90009h33j9np8l17t	integration.shipstation.configured	integration	cmgzzflfv0001cqkboq8nvgvi	cmgzzeaa500011vtanifj1f2k	Hector Franco	hector.franco@calitho.com	50.236.93.94	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"enabled": true, "provider": "shipstation"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-22 16:45:18.622
cmh28w5r8000dh33j3xpdhwv3	integration.shipstation.configured	integration	cmgzzflfv0001cqkboq8nvgvi	cmgzzeaa500011vtanifj1f2k	Hector Franco	hector.franco@calitho.com	50.236.93.94	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"enabled": true, "provider": "shipstation"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-22 17:06:19.557
cmh2yaebh000b4c9l3we2a3i3	tracking_update	ShippingLabel	cmh2l28lv000zh33j19y47tsw	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841399247181", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T04:57:14.237Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 04:57:14.238
cmh2ybb6f000d4c9lqtabbku7	tracking_update	ShippingLabel	cmh2hlpi4000lh33jkpxds3he	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840190659177", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T04:57:56.822Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 04:57:56.823
cmh2yfb51000f4c9ltygr1qsf	tracking_update	ShippingLabel	cmh2huoy0000nh33jewlhq9l5	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840191681186", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T05:01:03.397Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 05:01:03.398
cmh30aqa40001mx84mnp2hvrm	tracking_update	ShippingLabel	cmh2hlpi4000lh33jkpxds3he	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840190659177", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T05:53:28.971Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 05:53:28.972
cmh30boct0003mx8448zhuqqw	tracking_update	ShippingLabel	cmh2huoy0000nh33jewlhq9l5	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840191681186", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T05:54:13.133Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 05:54:13.134
cmh38gve40005mx84czbxn0hy	tracking_update	ShippingLabel	cmh2huoy0000nh33jewlhq9l5	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840191681186", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T09:42:12.459Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 09:42:12.46
cmh39evmj0007mx84bnd689v6	tracking_update	ShippingLabel	cmh2hlpi4000lh33jkpxds3he	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840190659177", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T10:08:39.067Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 10:08:39.068
cmh3bjzxe0009mx848wygzf3i	tracking_update	ShippingLabel	cmh2hlpi4000lh33jkpxds3he	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840190659177", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T11:08:37.153Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 11:08:37.154
cmh3bk1ze000bmx843ty60a7f	tracking_update	ShippingLabel	cmh2huoy0000nh33jewlhq9l5	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840191681186", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T11:08:39.817Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 11:08:39.818
cmh3egq6b000dmx84u2g3ebwx	tracking_update	ShippingLabel	cmh2huoy0000nh33jewlhq9l5	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840191681186", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T12:30:03.395Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 12:30:03.396
cmh3erj25000fmx84z2w2b1sq	tracking_update	ShippingLabel	cmh2hlpi4000lh33jkpxds3he	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840190659177", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T12:38:27.389Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 12:38:27.39
cmh3f6bon000hmx84ma1l6tkg	tracking_update	ShippingLabel	cmh2huoy0000nh33jewlhq9l5	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840191681186", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T12:49:57.670Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 12:49:57.671
cmh3fp9ez000jmx8420k53ayi	tracking_update	ShippingLabel	cmh2hlpi4000lh33jkpxds3he	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840190659177", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T13:04:41.195Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 13:04:41.196
cmh3gfpf4000lmx84rv86fqvj	tracking_update	ShippingLabel	cmh2huoy0000nh33jewlhq9l5	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840191681186", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T13:25:14.991Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 13:25:14.992
cmh3gpo6s000nmx84dpthm45z	tracking_update	ShippingLabel	cmh2hlpi4000lh33jkpxds3he	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840190659177", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T13:32:59.955Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 13:32:59.956
cmh3grdpp000pmx84m8sz9t0a	tracking_update	ShippingLabel	cmh2huoy0000nh33jewlhq9l5	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840191681186", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T13:34:19.693Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 13:34:19.694
cmh3hae1e000rmx8488kugbqz	tracking_update	ShippingLabel	cmh2huoy0000nh33jewlhq9l5	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840191681186", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T13:49:06.577Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 13:49:06.578
cmh3hy4nc000tmx84ubwcfii0	tracking_update	ShippingLabel	cmh2l28lv000zh33j19y47tsw	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841399247181", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T14:07:34.152Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 14:07:34.153
cmh3i82pz000vmx84y312rqe5	tracking_update	ShippingLabel	cmh2ky6tu000xh33jexln04ft	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841399869572", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T14:15:18.215Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 14:15:18.216
cmh3iao8z000xmx84e0035vck	tracking_update	ShippingLabel	cmh2huoy0000nh33jewlhq9l5	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840191681186", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T14:17:19.427Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 14:17:19.428
cmh3ifgx1000zmx84rurnz0xh	tracking_update	ShippingLabel	cmh2l28lv000zh33j19y47tsw	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841399247181", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T14:21:03.205Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 14:21:03.206
cmh3j6fdw0015mx848r4h2lb9	tracking_update	ShippingLabel	cmh2ku48i000vh33jeyzr3ekn	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841394115199", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T14:42:00.931Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 14:42:00.932
cmh3jdm060017mx843gj2muzq	tracking_update	ShippingLabel	cmh2l28lv000zh33j19y47tsw	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841399247181", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T14:47:36.102Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 14:47:36.103
cmh3jzyjj0019mx84j8nnv1xd	tracking_update	ShippingLabel	cmh2l28lv000zh33j19y47tsw	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841399247181", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T15:04:58.782Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 15:04:58.783
cmh3k1rbp001bmx84v9e0ajzp	tracking_update	ShippingLabel	cmh2ky6tu000xh33jexln04ft	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841399869572", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T15:06:22.741Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 15:06:22.742
cmh3k2072001dmx84wkq922af	tracking_update	ShippingLabel	cmh2hlpi4000lh33jkpxds3he	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840190659177", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T15:06:34.237Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 15:06:34.238
cmh3k9ec8001fmx849likdncu	tracking_update	ShippingLabel	cmh2ky6tu000xh33jexln04ft	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841399869572", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T15:12:19.159Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 15:12:19.16
cmh3kbuql001hmx84g9yw6lda	tracking_update	ShippingLabel	cmh2huoy0000nh33jewlhq9l5	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840191681186", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T15:14:13.724Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 15:14:13.725
cmh3lnp66001jmx84e7t78yp0	tracking_update	ShippingLabel	cmh2l28lv000zh33j19y47tsw	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841399247181", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T15:51:25.998Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 15:51:25.999
cmh3lqt2g001lmx84sxatfxp9	tracking_update	ShippingLabel	cmh2huoy0000nh33jewlhq9l5	\N	\N	\N	\N	\N	{"status_code": "DE", "tracking_number": "1Z9634840191681186", "tracking_status": "delivered", "status_description": "Delivered", "webhook_received_at": "2025-10-23T15:53:51.015Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 15:53:51.016
cmh3lut3b001nmx84ak9dt1hl	tracking_update	ShippingLabel	cmh2ky6tu000xh33jexln04ft	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841399869572", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T15:56:57.670Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 15:56:57.671
cmh3muk4c0001pasfikey6dn6	tracking_update	ShippingLabel	cmh2ku48i000vh33jeyzr3ekn	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841394115199", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-23T16:24:45.659Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 16:24:45.66
cmh3oh9670003pasf9aymid30	tracking_update	ShippingLabel	cmh2hlpi4000lh33jkpxds3he	\N	\N	\N	\N	\N	{"status_code": "DE", "tracking_number": "1Z9634840190659177", "tracking_status": "delivered", "status_description": "Delivered", "webhook_received_at": "2025-10-23T17:10:24.174Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 17:10:24.175
cmh3qdlii0005pasfv156b55c	tracking_update	ShippingLabel	cmh2l28lv000zh33j19y47tsw	\N	\N	\N	\N	\N	{"status_code": "DE", "tracking_number": "1Z9634841399247181", "tracking_status": "delivered", "status_description": "Delivered", "webhook_received_at": "2025-10-23T18:03:32.777Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 18:03:32.778
cmh3qfpcu0007pasfk7fhfig8	tracking_update	ShippingLabel	cmh2ky6tu000xh33jexln04ft	\N	\N	\N	\N	\N	{"status_code": "DE", "tracking_number": "1Z9634841399869572", "tracking_status": "delivered", "status_description": "Delivered", "webhook_received_at": "2025-10-23T18:05:11.070Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 18:05:11.071
cmh4063t7000dti60oh2rvlq7	tracking_update	ShippingLabel	cmh4048ih0003ti606iwu8ddk	\N	\N	\N	\N	\N	{"status_code": "AC", "tracking_number": "1Z9634841399510458", "tracking_status": "accepted", "status_description": "Accepted", "webhook_received_at": "2025-10-23T22:37:39.403Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 22:37:39.404
cmh407cdx000fti60to4sfz0h	tracking_update	ShippingLabel	cmh405eyn000bti60u3nc0qbg	\N	\N	\N	\N	\N	{"status_code": "AC", "tracking_number": "1Z9634841395790896", "tracking_status": "accepted", "status_description": "Accepted", "webhook_received_at": "2025-10-23T22:38:37.173Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 22:38:37.174
cmh40q3dg000jti609p1su103	tracking_update	ShippingLabel	cmh40ohf4000hti60tp1orneb	\N	\N	\N	\N	\N	{"status_code": "AC", "tracking_number": "1Z9634841399921111", "tracking_status": "accepted", "status_description": "Accepted", "webhook_received_at": "2025-10-23T22:53:11.956Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 22:53:11.957
cmh40u3s4000nti60amlar8v0	tracking_update	ShippingLabel	cmh40scz3000lti60oylfaqgf	\N	\N	\N	\N	\N	{"status_code": "AC", "tracking_number": "1Z9634840196608729", "tracking_status": "accepted", "status_description": "Accepted", "webhook_received_at": "2025-10-23T22:56:19.107Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 22:56:19.108
cmh41t3a1000rti60fastnpgb	tracking_update	ShippingLabel	cmh41r9oz000pti60oz3fpsn2	\N	\N	\N	\N	\N	{"status_code": "AC", "tracking_number": "394590353418", "tracking_status": "accepted", "status_description": "Accepted", "webhook_received_at": "2025-10-23T23:23:31.417Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 23:23:31.418
cmh448415000tti60s1c0cd5w	tracking_update	ShippingLabel	cmh2ku48i000vh33jeyzr3ekn	\N	\N	\N	\N	\N	{"status_code": "DE", "tracking_number": "1Z9634841394115199", "tracking_status": "delivered", "status_description": "Delivered", "webhook_received_at": "2025-10-24T00:31:11.463Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 00:31:11.465
cmh475e6g000zti606o5oz4fy	tracking_update	ShippingLabel	cmh40scz3000lti60oylfaqgf	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840196608729", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T01:53:03.496Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 01:53:03.496
cmh47aj620011ti60kwyvaqza	tracking_update	ShippingLabel	cmh40ohf4000hti60tp1orneb	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841399921111", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T01:57:03.241Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 01:57:03.242
cmh4aw3v40001g2ycu1p6l930	tracking_update	ShippingLabel	cmh40scz3000lti60oylfaqgf	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840196608729", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T03:37:48.687Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 03:37:48.688
cmh4awvbf0003g2yci6opovhc	tracking_update	ShippingLabel	cmh40ohf4000hti60tp1orneb	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841399921111", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T03:38:24.266Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 03:38:24.267
cmh4eaz1j0003mnytc260b2o5	integration.netsuite.configured	integration	cmh4eayrr0001mnytpznlvoh7	cmgzzeaa500011vtanifj1f2k	Hector Franco	hector.franco@calitho.com	::1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"provider": "netsuite", "currentMode": "sandbox", "sandboxEnabled": true, "productionEnabled": false}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 05:13:21.127
cmh4ecdqt0007mnyt032vwbiz	integration.netsuite.configured	integration	cmh4eayrr0001mnytpznlvoh7	cmgzzeaa500011vtanifj1f2k	Hector Franco	hector.franco@calitho.com	::1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"provider": "netsuite", "currentMode": "sandbox", "sandboxEnabled": true, "productionEnabled": false}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 05:14:26.837
cmh4hvi5t0003f9g0dnpr9g0m	tracking_update	ShippingLabel	cmh40scz3000lti60oylfaqgf	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840196608729", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T06:53:17.873Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 06:53:17.873
cmh4hwxly0005f9g0m2byj5ma	tracking_update	ShippingLabel	cmh40ohf4000hti60tp1orneb	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841399921111", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T06:54:24.549Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 06:54:24.55
cmh4m68m10007f9g0yl5inbf6	tracking_update	ShippingLabel	cmh40ohf4000hti60tp1orneb	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841399921111", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T08:53:37.176Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 08:53:37.177
cmh4m6mg20009f9g0wb6jlvdv	tracking_update	ShippingLabel	cmh40scz3000lti60oylfaqgf	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840196608729", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T08:53:55.105Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 08:53:55.106
cmh4n963p000bf9g0g7f9wd72	tracking_update	ShippingLabel	cmh41r9oz000pti60oz3fpsn2	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "394590353418", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T09:23:53.509Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 09:23:53.51
cmh4os8yr000df9g03nvtduwa	tracking_update	ShippingLabel	cmh40scz3000lti60oylfaqgf	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840196608729", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T10:06:43.298Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 10:06:43.299
cmh4pbjzq000ff9g0oiixtc5d	tracking_update	ShippingLabel	cmh40ohf4000hti60tp1orneb	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841399921111", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T10:21:44.054Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 10:21:44.055
cmh4rgg66000hf9g0evka53wn	tracking_update	ShippingLabel	cmh40ohf4000hti60tp1orneb	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841399921111", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T11:21:31.613Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 11:21:31.614
cmh4rjlbl000jf9g0rdbh9e83	tracking_update	ShippingLabel	cmh41r9oz000pti60oz3fpsn2	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "394590353418", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T11:23:58.257Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 11:23:58.258
cmh4s69pv000lf9g0fway4sjg	tracking_update	ShippingLabel	cmh40scz3000lti60oylfaqgf	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840196608729", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T11:41:36.307Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 11:41:36.308
cmh4snn6b000nf9g0ly6ziap0	tracking_update	ShippingLabel	cmh40ohf4000hti60tp1orneb	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841399921111", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T11:55:06.898Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 11:55:06.899
cmh4su5ra000pf9g01ha0ajce	tracking_update	ShippingLabel	cmh40scz3000lti60oylfaqgf	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840196608729", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T12:00:10.918Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 12:00:10.919
cmh4t8xfv000rf9g0o48onvnf	tracking_update	ShippingLabel	cmh40ohf4000hti60tp1orneb	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841399921111", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T12:11:39.978Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 12:11:39.979
cmh4vf1jb000tf9g0r5vludvm	tracking_update	ShippingLabel	cmh40ohf4000hti60tp1orneb	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841399921111", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T13:12:24.454Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 13:12:24.455
cmh4vtyqk000vf9g0uoeu93l6	tracking_update	ShippingLabel	cmh41r9oz000pti60oz3fpsn2	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "394590353418", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T13:24:00.667Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 13:24:00.668
cmh4w5tm9000xf9g02zbemkfk	tracking_update	ShippingLabel	cmh40scz3000lti60oylfaqgf	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840196608729", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T13:33:13.904Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 13:33:13.905
cmh4xq5hk000zf9g0jzg22y8p	tracking_update	ShippingLabel	cmh40scz3000lti60oylfaqgf	\N	\N	\N	\N	\N	{"status_code": "DE", "tracking_number": "1Z9634840196608729", "tracking_status": "delivered", "status_description": "Delivered", "webhook_received_at": "2025-10-24T14:17:02.023Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 14:17:02.024
cmh504bcn0011f9g0q7dx5y8d	tracking_update	ShippingLabel	cmh41r9oz000pti60oz3fpsn2	\N	\N	\N	\N	\N	{"status_code": "DE", "tracking_number": "394590353418", "tracking_status": "delivered", "status_description": "Delivered", "webhook_received_at": "2025-10-24T15:24:02.038Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 15:24:02.04
cmh5087b000034wbl89l9emve	integration.netsuite.configured	integration	cmh4eayrr0001mnytpznlvoh7	cmgzzeaa500011vtanifj1f2k	Hector Franco	hector.franco@calitho.com	::1	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	{"provider": "netsuite", "currentMode": "sandbox", "sandboxEnabled": true, "productionEnabled": false}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 15:27:03.42
cmh53xcs000051014yvtlmsu8	tracking_update	ShippingLabel	cmh53vojl00031014h5ndq23j	\N	\N	\N	\N	\N	{"status_code": "AC", "tracking_number": "1Z9634840195823891", "tracking_status": "accepted", "status_description": "Accepted", "webhook_received_at": "2025-10-24T17:10:35.760Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 17:10:35.761
cmh55e31r000wx0zyinm0onh4	user.created	user	cmh55e2jc000sx0zy1r291pqe	cmgzzeaa500011vtanifj1f2k	Hector Franco	hector.franco@calitho.com	\N	\N	{"role": "logistics", "userName": "Stephanie Becerra", "userEmail": "stephanie.becerra@calitho.com", "inviteSent": false, "temporaryPassword": false}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 17:51:35.92
cmh55fo0f0011x0zy1fm8dm15	user.created	user	cmh55fnpw000xx0zyd5j4jdjf	cmgzzeaa500011vtanifj1f2k	Hector Franco	hector.franco@calitho.com	\N	\N	{"role": "logistics", "userName": "Shipping", "userEmail": "shipping@calitho.com", "inviteSent": false, "temporaryPassword": false}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 17:52:49.743
cmh57nne100052q4zqmzxpy3n	tracking_update	ShippingLabel	cmh57lw1a00012q4z5gyf35dc	\N	\N	\N	\N	\N	{"status_code": "AC", "tracking_number": "1Z9634840398954115", "tracking_status": "accepted", "status_description": "Accepted", "webhook_received_at": "2025-10-24T18:55:01.410Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 18:55:01.417
cmh59581h000169wifdfe8dqz	tracking_update	ShippingLabel	cmh54tfjm0001x0zyfc4ftuya	\N	\N	\N	\N	\N	{"status_code": "AC", "tracking_number": "394615445008", "tracking_status": "accepted", "status_description": "Accepted", "webhook_received_at": "2025-10-24T19:36:40.948Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 19:36:40.949
cmh59a2i9000569wi3scf2f8z	tracking_update	ShippingLabel	cmh598kdc000369wizsh9qomh	\N	\N	\N	\N	\N	{"status_code": "AC", "tracking_number": "1Z9634841297744336", "tracking_status": "accepted", "status_description": "Accepted", "webhook_received_at": "2025-10-24T19:40:27.057Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 19:40:27.057
cmh5atfn30005w84gl59pykyn	tracking_update	ShippingLabel	cmh40ohf4000hti60tp1orneb	\N	\N	\N	\N	\N	{"status_code": "DE", "tracking_number": "1Z9634841399921111", "tracking_status": "delivered", "status_description": "Delivered", "webhook_received_at": "2025-10-24T20:23:30.159Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 20:23:30.16
cmh5avr720009w84ggz0pjc8d	tracking_update	ShippingLabel	cmh5au6s30007w84gavnh3ejo	\N	\N	\N	\N	\N	{"status_code": "AC", "tracking_number": "1Z9634840399261942", "tracking_status": "accepted", "status_description": "Accepted", "webhook_received_at": "2025-10-24T20:25:18.446Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 20:25:18.447
cmh5b0itd000dw84giluu0cuw	tracking_update	ShippingLabel	cmh5ayv2d000bw84ghbq8elhk	\N	\N	\N	\N	\N	{"status_code": "AC", "tracking_number": "1Z9634840390451333", "tracking_status": "accepted", "status_description": "Accepted", "webhook_received_at": "2025-10-24T20:29:00.865Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 20:29:00.865
cmh5b9tgo000fw84gkh7bf0ht	tracking_update	ShippingLabel	cmh56xrr70019x0zy1nmdlvyu	\N	\N	\N	\N	\N	{"status_code": "AC", "tracking_number": "394618549071", "tracking_status": "accepted", "status_description": "Accepted", "webhook_received_at": "2025-10-24T20:36:14.568Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 20:36:14.569
cmh5bfb2g000414mf7m8m8fvr	user.created	user	cmh5bfaf4000014mfcss58x4x	cmgzzeaa500011vtanifj1f2k	Hector Franco	hector.franco@calitho.com	\N	\N	{"role": "estimators", "userName": "Rob Reuben", "userEmail": "rob.reuben@calitho.com", "inviteSent": false, "temporaryPassword": false}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 20:40:30.665
cmh5br8qb0001v8iomd2cesrf	tracking_update	ShippingLabel	cmh5bplto0001uz37dhkx4n4s	\N	\N	\N	\N	\N	{"status_code": "AC", "tracking_number": "1Z9634849090491350", "tracking_status": "accepted", "status_description": "Accepted", "webhook_received_at": "2025-10-24T20:49:47.506Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 20:49:47.507
cmh5brc900003v8iotg486jbm	tracking_update	ShippingLabel	cmh5bpm6z0003uz37yl12dnij	\N	\N	\N	\N	\N	{"status_code": "AC", "tracking_number": "1Z9634840392065346", "tracking_status": "accepted", "status_description": "Accepted", "webhook_received_at": "2025-10-24T20:49:52.067Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 20:49:52.068
cmh5c6h1g0007v8io6yck3vl8	tracking_update	ShippingLabel	cmh5c4pi60005v8ioapyhhbns	\N	\N	\N	\N	\N	{"status_code": "AC", "tracking_number": "1Z9634840390129361", "tracking_status": "accepted", "status_description": "Accepted", "webhook_received_at": "2025-10-24T21:01:38.116Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 21:01:38.117
cmh5c789g0009v8ioc0zxuzg3	tracking_update	ShippingLabel	cmh57v7oe00072q4zcxvxt2ac	\N	\N	\N	\N	\N	{"status_code": "AC", "tracking_number": "394619915655", "tracking_status": "accepted", "status_description": "Accepted", "webhook_received_at": "2025-10-24T21:02:13.395Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 21:02:13.396
cmh5g1hzy000zv8io1r1urwiu	tracking_update	ShippingLabel	cmh5fzk46000tv8iowtomqre2	\N	\N	\N	\N	\N	{"status_code": "AC", "tracking_number": "1Z9634841390379377", "tracking_status": "accepted", "status_description": "Accepted", "webhook_received_at": "2025-10-24T22:49:44.542Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 22:49:44.543
cmh5ga8p00013v8io0uwsgn4h	tracking_update	ShippingLabel	cmh5g8jen0011v8io797ciecu	\N	\N	\N	\N	\N	{"status_code": "AC", "tracking_number": "1Z9634841393801403", "tracking_status": "accepted", "status_description": "Accepted", "webhook_received_at": "2025-10-24T22:56:32.387Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 22:56:32.388
cmh5ghn3p0015v8iombx9w4ls	tracking_update	ShippingLabel	cmh57v7oe00072q4zcxvxt2ac	\N	\N	\N	\N	\N	{"status_code": "AC", "tracking_number": "394619915655", "tracking_status": "accepted", "status_description": "Accepted", "webhook_received_at": "2025-10-24T23:02:17.653Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 23:02:17.654
cmh5hljqi00013c8ryihj6jbh	tracking_update	ShippingLabel	cmh53vojl00031014h5ndq23j	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840195823891", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T23:33:19.530Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 23:33:19.531
cmh5hlm7400033c8r2ve7evjc	tracking_update	ShippingLabel	cmh5g8jen0011v8io797ciecu	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841393801403", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T23:33:22.720Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 23:33:22.721
cmh5hlmu400053c8rt7jm3gil	tracking_update	ShippingLabel	cmh598kdc000369wizsh9qomh	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841297744336", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T23:33:23.547Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 23:33:23.548
cmh5hlr2q00073c8r00ke2qx6	tracking_update	ShippingLabel	cmh5c4pi60005v8ioapyhhbns	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840390129361", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T23:33:29.041Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 23:33:29.042
cmh5hls2n00093c8rxwpsd35i	tracking_update	ShippingLabel	cmh5fzk46000tv8iowtomqre2	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841390379377", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T23:33:30.335Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 23:33:30.336
cmh5hlt5b000b3c8r1efntvko	tracking_update	ShippingLabel	cmh57lw1a00012q4z5gyf35dc	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840398954115", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T23:33:31.727Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 23:33:31.728
cmh5hlyq5000d3c8rzhzej7wm	tracking_update	ShippingLabel	cmh5au6s30007w84gavnh3ejo	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840399261942", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T23:33:38.957Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 23:33:38.958
cmh5hq1jh000f3c8ri8xp6a8t	tracking_update	ShippingLabel	cmh54tfjm0001x0zyfc4ftuya	\N	\N	\N	\N	\N	{"status_code": "AC", "tracking_number": "394615445008", "tracking_status": "accepted", "status_description": "Accepted", "webhook_received_at": "2025-10-24T23:36:49.228Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 23:36:49.229
cmh5igqy1000j3c8rxsapxczv	tracking_update	ShippingLabel	cmh5g8jen0011v8io797ciecu	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841393801403", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T23:57:35.208Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 23:57:35.209
cmh5ihjlp000l3c8rdi3h654t	tracking_update	ShippingLabel	cmh53vojl00031014h5ndq23j	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840195823891", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-24T23:58:12.348Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-24 23:58:12.349
cmh5juje0000n3c8ri1doac5f	tracking_update	ShippingLabel	cmh56xrr70019x0zy1nmdlvyu	\N	\N	\N	\N	\N	{"status_code": "AC", "tracking_number": "394618549071", "tracking_status": "accepted", "status_description": "Accepted", "webhook_received_at": "2025-10-25T00:36:18.215Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 00:36:18.216
cmh5lgyb7000p3c8rfumqb6tt	tracking_update	ShippingLabel	cmh57lw1a00012q4z5gyf35dc	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840398954115", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T01:21:43.602Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 01:21:43.603
cmh5liwya000r3c8rejmvea9m	tracking_update	ShippingLabel	cmh5c4pi60005v8ioapyhhbns	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840390129361", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T01:23:15.154Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 01:23:15.154
cmh5lje2y000t3c8rndz8b2yw	tracking_update	ShippingLabel	cmh598kdc000369wizsh9qomh	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841297744336", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T01:23:37.354Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 01:23:37.355
cmh5lr425000v3c8rx0ubc0vw	tracking_update	ShippingLabel	cmh53vojl00031014h5ndq23j	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840195823891", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T01:29:37.612Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 01:29:37.613
cmh5lwi6e000x3c8rxjc2z6nh	tracking_update	ShippingLabel	cmh5g8jen0011v8io797ciecu	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841393801403", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T01:33:49.190Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 01:33:49.191
cmh5lxf6h000z3c8rgeb1ox1c	tracking_update	ShippingLabel	cmh5fzk46000tv8iowtomqre2	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841390379377", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T01:34:31.961Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 01:34:31.962
cmh5nlz0n00113c8ra7t3cknu	tracking_update	ShippingLabel	cmh5au6s30007w84gavnh3ejo	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840399261942", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T02:21:37.030Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 02:21:37.031
cmh5p2o7n00133c8r25ygr9m7	tracking_update	ShippingLabel	cmh57v7oe00072q4zcxvxt2ac	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "394619915655", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T03:02:35.795Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 03:02:35.795
cmh5qb6a300153c8r3rloe66v	tracking_update	ShippingLabel	cmh54tfjm0001x0zyfc4ftuya	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "394615445008", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T03:37:12.074Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 03:37:12.075
cmh5rvay100173c8rl5ryt2s8	tracking_update	ShippingLabel	cmh53vojl00031014h5ndq23j	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840195823891", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T04:20:50.857Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 04:20:50.858
cmh5rvq0t00193c8ryyr2bzuk	tracking_update	ShippingLabel	cmh5g8jen0011v8io797ciecu	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841393801403", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T04:21:10.396Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 04:21:10.397
cmh5rw18l001b3c8rzrzmyrt1	tracking_update	ShippingLabel	cmh5fzk46000tv8iowtomqre2	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841390379377", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T04:21:24.932Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 04:21:24.933
cmh5sgddy001d3c8rd91uvjgz	tracking_update	ShippingLabel	cmh5au6s30007w84gavnh3ejo	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840399261942", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T04:37:13.798Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 04:37:13.799
cmh5shqhr001f3c8r32pl7qeu	tracking_update	ShippingLabel	cmh5c4pi60005v8ioapyhhbns	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840390129361", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T04:38:17.438Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 04:38:17.439
cmh5u4p2h001h3c8rykobm52k	tracking_update	ShippingLabel	cmh57lw1a00012q4z5gyf35dc	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840398954115", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T05:24:08.296Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 05:24:08.297
cmh5ulilu001j3c8rmjjhlpus	tracking_update	ShippingLabel	cmh54tfjm0001x0zyfc4ftuya	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "394615445008", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T05:37:13.074Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 05:37:13.074
cmh5vlbq9001l3c8rg8sghh60	tracking_update	ShippingLabel	cmh5au6s30007w84gavnh3ejo	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840399261942", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T06:05:03.777Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 06:05:03.778
cmh5vlm8d001n3c8ruxo8z3wn	tracking_update	ShippingLabel	cmh5c4pi60005v8ioapyhhbns	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840390129361", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T06:05:17.389Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 06:05:17.39
cmh5vlmoc001p3c8rygqnrwhr	tracking_update	ShippingLabel	cmh57lw1a00012q4z5gyf35dc	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840398954115", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T06:05:17.964Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 06:05:17.965
cmh5wqttp001r3c8r9ogepu4v	tracking_update	ShippingLabel	cmh56xrr70019x0zy1nmdlvyu	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "394618549071", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T06:37:20.124Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 06:37:20.125
cmh5x9oui001t3c8rdlx29sqt	tracking_update	ShippingLabel	cmh5g8jen0011v8io797ciecu	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841393801403", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T06:52:00.137Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 06:52:00.138
cmh5xa7kb001v3c8r8n9w6xlm	tracking_update	ShippingLabel	cmh5fzk46000tv8iowtomqre2	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841390379377", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T06:52:24.394Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 06:52:24.395
cmh5xf3f7001x3c8rl2dsg64w	tracking_update	ShippingLabel	cmh53vojl00031014h5ndq23j	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840195823891", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T06:56:12.307Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 06:56:12.307
cmh5xnhgk001z3c8rzdmis7pr	tracking_update	ShippingLabel	cmh57v7oe00072q4zcxvxt2ac	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "394619915655", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T07:02:43.748Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 07:02:43.749
cmh5yw1tf00213c8rj6k9btyf	tracking_update	ShippingLabel	cmh54tfjm0001x0zyfc4ftuya	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "394615445008", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T07:37:22.995Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 07:37:22.996
cmh60gc9g00233c8rmwrc3fvt	tracking_update	ShippingLabel	cmh598kdc000369wizsh9qomh	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841297744336", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T08:21:09.267Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 08:21:09.268
cmh61xzxo00253c8rf3cw3i8v	tracking_update	ShippingLabel	cmh57v7oe00072q4zcxvxt2ac	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "394619915655", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T09:02:52.716Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 09:02:52.717
cmh624uga00273c8rzckd4rkn	tracking_update	ShippingLabel	cmh5au6s30007w84gavnh3ejo	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840399261942", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T09:08:12.202Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 09:08:12.203
cmh62jnxe00293c8ro5j6b6h9	tracking_update	ShippingLabel	cmh598kdc000369wizsh9qomh	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841297744336", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T09:19:43.586Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 09:19:43.587
cmh62jo7t002b3c8rn9qwjljj	tracking_update	ShippingLabel	cmh57lw1a00012q4z5gyf35dc	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840398954115", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T09:19:43.961Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 09:19:43.962
cmh636eoh002d3c8r1tsm32r1	tracking_update	ShippingLabel	cmh54tfjm0001x0zyfc4ftuya	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "394615445008", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T09:37:24.689Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 09:37:24.69
cmh64cbz4002f3c8rj8pc31uo	tracking_update	ShippingLabel	cmh5c4pi60005v8ioapyhhbns	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840390129361", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T10:10:00.735Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 10:10:00.736
cmh67d2gc002h3c8ryefrlvdw	tracking_update	ShippingLabel	cmh5au6s30007w84gavnh3ejo	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840399261942", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T11:34:33.899Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 11:34:33.9
cmh69lzzc002j3c8rmeieiaj3	tracking_update	ShippingLabel	cmh56xrr70019x0zy1nmdlvyu	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "394618549071", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T12:37:29.831Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 12:37:29.832
cmh6cm8b6002l3c8rl0c9f1h5	tracking_update	ShippingLabel	cmh5au6s30007w84gavnh3ejo	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840399261942", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T14:01:39.473Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 14:01:39.474
cmh6j28y8002n3c8rxcahndqb	tracking_update	ShippingLabel	cmh57lw1a00012q4z5gyf35dc	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840398954115", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T17:02:04.495Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 17:02:04.496
cmh6r62o3002p3c8rsiqn6ogy	tracking_update	ShippingLabel	cmh6r4cew0005otpug59zau8f	\N	\N	\N	\N	\N	{"status_code": "AC", "tracking_number": "797699508524", "tracking_status": "accepted", "status_description": "Accepted", "webhook_received_at": "2025-10-25T20:48:59.907Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 20:48:59.907
cmh6rniz2002r3c8rah0d2eis	tracking_update	ShippingLabel	cmh53vojl00031014h5ndq23j	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840195823891", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-25T21:02:34.190Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 21:02:34.191
cmh6v26un002t3c8r72af23fn	tracking_update	ShippingLabel	cmh56xrr70019x0zy1nmdlvyu	\N	\N	\N	\N	\N	{"status_code": "DE", "tracking_number": "394618549071", "tracking_status": "delivered", "status_description": "Delivered", "webhook_received_at": "2025-10-25T22:37:57.166Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-25 22:37:57.167
cmh6zttki00018frz7f1vq1xx	tracking_update	ShippingLabel	cmh53vojl00031014h5ndq23j	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840195823891", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-26T00:51:24.785Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-26 00:51:24.786
cmh709dnq00038frzcih57hsf	tracking_update	ShippingLabel	cmh57v7oe00072q4zcxvxt2ac	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "394619915655", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-26T01:03:30.662Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-26 01:03:30.663
cmh71hn7i00058frz93qmg9xc	tracking_update	ShippingLabel	cmh54tfjm0001x0zyfc4ftuya	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "394615445008", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-26T01:37:55.902Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-26 01:37:55.903
cmh7q007c00078frz2emusms0	tracking_update	ShippingLabel	cmh57v7oe00072q4zcxvxt2ac	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "394619915655", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-26T13:04:03.334Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-26 13:04:03.335
cmh7r8gap00098frz4urhr3q6	tracking_update	ShippingLabel	cmh54tfjm0001x0zyfc4ftuya	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "394615445008", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-26T13:38:37.056Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-26 13:38:37.057
cmh828mgk000b8frzsdw0zuow	tracking_update	ShippingLabel	cmh5fzk46000tv8iowtomqre2	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841390379377", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-26T18:46:40.820Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-26 18:46:40.821
cmh83ba7p000d8frzrzv51cyu	tracking_update	ShippingLabel	cmh5fzk46000tv8iowtomqre2	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841390379377", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-26T19:16:44.532Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-26 19:16:44.533
cmh83bmkm000f8frzr4z5b8ek	tracking_update	ShippingLabel	cmh5g8jen0011v8io797ciecu	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841393801403", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-26T19:17:00.549Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-26 19:17:00.55
cmh8fqkr5000h8frz5hm1pqwy	tracking_update	ShippingLabel	cmh57v7oe00072q4zcxvxt2ac	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "394619915655", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-27T01:04:33.424Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-27 01:04:33.425
cmh8gz29o000j8frzgb33522k	tracking_update	ShippingLabel	cmh54tfjm0001x0zyfc4ftuya	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "394615445008", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-27T01:39:08.988Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-27 01:39:08.989
cmh8lk3lt000l8frzel51lgsd	tracking_update	ShippingLabel	cmh53vojl00031014h5ndq23j	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840195823891", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-27T03:47:28.960Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-27 03:47:28.961
cmh8npyez000n8frzbse033xy	tracking_update	ShippingLabel	cmh53vojl00031014h5ndq23j	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840195823891", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-27T04:48:01.403Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-27 04:48:01.404
cmh8wv7zv000p8frzhcavpai0	tracking_update	ShippingLabel	cmh5g8jen0011v8io797ciecu	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841393801403", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-27T09:04:03.642Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-27 09:04:03.643
cmh8xfjnq000r8frzse228xfo	tracking_update	ShippingLabel	cmh598kdc000369wizsh9qomh	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841297744336", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-27T09:19:51.877Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-27 09:19:51.878
cmh8yp9ya000t8frzrrlgnwcw	tracking_update	ShippingLabel	cmh5g8jen0011v8io797ciecu	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841393801403", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-27T09:55:25.474Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-27 09:55:25.475
cmh8ypc95000v8frzbapn9cb0	tracking_update	ShippingLabel	cmh5fzk46000tv8iowtomqre2	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841390379377", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-27T09:55:28.456Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-27 09:55:28.457
cmh8z82df000x8frz5eli8b90	tracking_update	ShippingLabel	cmh5c4pi60005v8ioapyhhbns	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840390129361", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-27T10:10:02.114Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-27 10:10:02.115
cmh8zh3p6000z8frzgwe59gh0	tracking_update	ShippingLabel	cmh5fzk46000tv8iowtomqre2	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841390379377", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-27T10:17:03.737Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-27 10:17:03.738
cmh92pvo600118frzfv4wpib3	tracking_update	ShippingLabel	cmh53vojl00031014h5ndq23j	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840195823891", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-27T11:47:52.085Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-27 11:47:52.086
cmh94139e00138frzaxy7kkcv	tracking_update	ShippingLabel	cmh53vojl00031014h5ndq23j	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840195823891", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-27T12:24:34.753Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-27 12:24:34.754
cmh95gy1o00158frz6olj5vgh	tracking_update	ShippingLabel	cmh57v7oe00072q4zcxvxt2ac	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "394619915655", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-27T13:04:54.107Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-27 13:04:54.108
cmh96pdpp00178frzhohxxuze	tracking_update	ShippingLabel	cmh54tfjm0001x0zyfc4ftuya	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "394615445008", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-27T13:39:27.276Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-27 13:39:27.277
cmh972ty500198frz01eztlen	tracking_update	ShippingLabel	cmh5fzk46000tv8iowtomqre2	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634841390379377", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-27T13:49:54.845Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-27 13:49:54.845
cmh9771aw001b8frzl4idkdec	tracking_update	ShippingLabel	cmh5au6s30007w84gavnh3ejo	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840399261942", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-27T13:53:11.000Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-27 13:53:11.001
cmh9909yc001d8frzosxe1a3q	tracking_update	ShippingLabel	cmh5g8jen0011v8io797ciecu	\N	\N	\N	\N	\N	{"status_code": "DE", "tracking_number": "1Z9634841393801403", "tracking_status": "delivered", "status_description": "Delivered", "webhook_received_at": "2025-10-27T14:43:54.851Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-27 14:43:54.852
cmh99qe67001h8frzrlaohib2	tracking_update	ShippingLabel	cmh5au6s30007w84gavnh3ejo	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840399261942", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-27T15:04:13.375Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-27 15:04:13.376
cmh9ap5js001j8frzc4y39cx3	tracking_update	ShippingLabel	cmh5au6s30007w84gavnh3ejo	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840399261942", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-27T15:31:15.159Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-27 15:31:15.16
cmh9azpry001l8frzaigdqp9x	tracking_update	ShippingLabel	cmh54tfjm0001x0zyfc4ftuya	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "394615445008", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-27T15:39:27.933Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-27 15:39:27.934
cmh9cc94m001n8frzb747obq2	tracking_update	ShippingLabel	cmh53vojl00031014h5ndq23j	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840195823891", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-27T16:17:12.502Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-27 16:17:12.503
cmh9d032s001r8frzdqmznnnd	tracking_update	ShippingLabel	cmh53vojl00031014h5ndq23j	\N	\N	\N	\N	\N	{"status_code": "DE", "tracking_number": "1Z9634840195823891", "tracking_status": "delivered", "status_description": "Delivered", "webhook_received_at": "2025-10-27T16:35:44.403Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-27 16:35:44.404
cmh9dxrzv001x8frzvdfetmz4	tracking_update	ShippingLabel	cmh5au6s30007w84gavnh3ejo	\N	\N	\N	\N	\N	{"status_code": "DE", "tracking_number": "1Z9634840399261942", "tracking_status": "delivered", "status_description": "Delivered", "webhook_received_at": "2025-10-27T17:01:56.347Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-27 17:01:56.348
cmh9dxzzc001z8frz0zfc6k6k	tracking_update	ShippingLabel	cmh57lw1a00012q4z5gyf35dc	\N	\N	\N	\N	\N	{"status_code": "IT", "tracking_number": "1Z9634840398954115", "tracking_status": "in_transit", "status_description": "In Transit", "webhook_received_at": "2025-10-27T17:02:06.695Z"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-27 17:02:06.696
\.


--
-- Data for Name: BatchImport; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."BatchImport" (id, "fileName", "fileUrl", "sheetName", status, "totalRows", "processedRows", "successfulRows", "failedRows", "carrierId", "carrierCode", "serviceCode", carrier, service, "billToParty", "billToAccount", "billToCountryCode", "billToPostalCode", "containsAlcohol", "saturdayDelivery", confirmation, "notificationsEmail", "fromAddress", "columnMapping", "tenantId", "createdBy", "createdAt", "updatedAt", "startedAt", "completedAt") FROM stdin;
cmh3rkwsp0001vi7ioccvnnv8	J112197_GROUND_07-10 & 07-11.xlsx	\N	Test	COMPLETE	1	1	0	1	se-3932358	fedex	fedex_ground	FedEx	FedEx Ground®	third_party	204762943	US	10016	f	f	none	\N	"{\\"zip\\":\\"94520\\",\\"city\\":\\"Concord\\",\\"name\\":\\"Shipping Manager\\",\\"phone\\":\\"9256821111\\",\\"state\\":\\"CA\\",\\"company\\":\\"Calitho\\",\\"country\\":\\"US\\",\\"street1\\":\\"2312 Stanwell Dr\\",\\"street2\\":\\"\\"}"	{"width": "DimensionsW", "height": "DimensionsH", "length": "DimensionsL", "weight": "PackageWeight", "shipDate": "ShipDate", "jobNumber": "Job#", "shipToZip": "ShipToZipCode", "itemNumber": "ItemNumber", "reference1": "Reference1", "reference2": "Reference2", "reference3": "Reference3", "shipToCity": "ShipToCity", "shipToName": "ShipToCompany", "shipToPhone": "ShipToPhoneNo", "shipToState": "ShipToState", "itemQuantity": "ItemQuantity", "packageNumber": "PackageNumber", "shipToCompany": "ShipToName", "shipToCountry": "ShipToCountry", "totalPackages": "TotalPackages", "shipToAddress1": "ShipToAddressline1"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 18:37:13.609	2025-10-23 18:37:18.184	2025-10-23 18:37:15.098	2025-10-23 18:37:18.183
cmh3sd9vk0004vi7inzdv6p8h	J112197_GROUND_07-10 & 07-11.xlsx	\N	Test	COMPLETE	1	1	0	1	se-3932358	fedex	fedex_ground	FedEx	FedEx Ground®	third_party	204762943	US	10016	f	f	none	\N	"{\\"zip\\":\\"94520\\",\\"city\\":\\"Concord\\",\\"name\\":\\"Shipping Manager\\",\\"phone\\":\\"9256821111\\",\\"state\\":\\"CA\\",\\"company\\":\\"Calitho\\",\\"country\\":\\"US\\",\\"street1\\":\\"2312 Stanwell Dr\\",\\"street2\\":\\"\\"}"	{"width": "DimensionsW", "height": "DimensionsH", "length": "DimensionsL", "weight": "PackageWeight", "shipDate": "ShipDate", "jobNumber": "Job#", "shipToZip": "ShipToZipCode", "itemNumber": "ItemNumber", "reference1": "Reference1", "reference2": "Reference2", "reference3": "Reference3", "shipToCity": "ShipToCity", "shipToName": "ShipToCompany", "shipToPhone": "ShipToPhoneNo", "shipToState": "ShipToState", "itemQuantity": "ItemQuantity", "packageNumber": "PackageNumber", "shipToCompany": "ShipToName", "shipToCountry": "ShipToCountry", "totalPackages": "TotalPackages", "shipToAddress1": "ShipToAddressline1"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 18:59:16.928	2025-10-23 19:00:22.156	2025-10-23 18:59:18.348	2025-10-23 18:59:21.415
\.


--
-- Data for Name: BatchImportMapping; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."BatchImportMapping" (id, "userId", "tenantId", "mappingName", "columnMappings", "isDefault", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: BatchImportRow; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."BatchImportRow" (id, "batchImportId", "rowNumber", status, "groupKey", "shipDate", "jobNumber", "totalPackages", "packageNumber", "shipToName", "shipToCompany", "shipToAddress1", "shipToAddress2", "shipToCity", "shipToState", "shipToZip", "shipToCountry", "shipToPhone", weight, length, width, height, reference1, reference2, reference3, "itemNumber", "itemQuantity", "trackingNumber", "trackingUrl", "labelUrl", "shippingCost", "errorMessage", notes, "retryCount", "maxRetries", "lastAttemptAt", "isTransientError", "paceJobShipmentId", "paceCartonId", "shipstationShipmentId", "shipstationLabelId", "createdAt", "updatedAt", "processedAt") FROM stdin;
cmh3rkwsp0002vi7ivw0shvwt	cmh3rkwsp0001vi7ioccvnnv8	2	FAILED	1-2025-10-23-19555 s. mountain house pkwy-mountain house-ca-95391	2025-10-23 08:00:00	1	1	1	Store Manager	Safeway - Store/Club #55	19555 S. Mountain House Pkwy	\N	Mountain House	CA	95391	US	1111111111	10	10	10	2	Safeway - CL121728	Safeway - CL121728	J112197-A1	64620	1	\N	\N	\N	\N	Labels created but PACE failed: PACE API error: 500 - {"message":"charges, This enumerated list field contains a value that is no longer in the associated list. value: ThirdParty/ShipBillTo: JobShipment[charges=ThirdParty/ShipBillTo]"}	\N	1	3	2025-10-23 18:37:15.243	f	\N	\N	\N	\N	2025-10-23 18:37:13.609	2025-10-23 18:37:17.892	2025-10-23 18:37:17.891
cmh3sd9vk0005vi7ims5sc47u	cmh3sd9vk0004vi7inzdv6p8h	2	FAILED	1-2025-10-23-19555 s. mountain house pkwy-mountain house-ca-95391	2025-10-23 08:00:00	1	1	1	Store Manager	Safeway - Store/Club #55	19555 S. Mountain House Pkwy	\N	Mountain House	CA	95391	US	1111111111	10	10	10	2	Safeway - CL121728	Safeway - CL121728	J112197-A1	64620	1	\N	\N	\N	0	Label voided by user	\N	1	3	2025-10-23 18:59:18.495	f	140008	153798	se-159778613	se-74196070	2025-10-23 18:59:16.928	2025-10-23 19:00:21.577	2025-10-23 18:59:20.978
\.


--
-- Data for Name: CarrierServiceMapping; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."CarrierServiceMapping" (id, "shipstationCarrierId", "shipstationCarrierCode", "shipstationServiceCode", "carrierName", "serviceName", "paceShipViaId", "paceShipViaName", "tenantId", "createdAt", "updatedAt") FROM stdin;
cmh0uc7wb000flsmi1wjc1qa5	se-3933051	se	ups_2nd_day_air	UPS	Ups 2nd Day Air	5019	UPS Ups 2nd Day Air	cmgzzea5200001vtaazq29pyk	2025-10-21 17:31:08.411	2025-10-21 17:31:08.411
cmh0u9ir5000blsmi2ns6kbhf	se-3932358	se	fedex_first_overnight	FedEx	Fedex First Overnight	5004	FedEx Fedex First Overnight	cmgzzea5200001vtaazq29pyk	2025-10-21 17:29:02.513	2025-10-21 17:29:02.513
cmh0ue1r2000nlsmib0immw7q	se-3933051	se	ups_next_day_air	UPS	Ups Next Day Air	5064	UPS Ups Next Day Air	cmgzzea5200001vtaazq29pyk	2025-10-21 17:32:33.759	2025-10-21 17:32:33.759
cmh0uae82000dlsmio0u1oirw	se-3932358	se	fedex_standard_overnight	FedEx	Fedex Standard Overnight	5024	FedEx Fedex Standard Overnight	cmgzzea5200001vtaazq29pyk	2025-10-21 17:29:43.299	2025-10-21 17:29:43.299
cmh0ueihd000plsmim0tw5hjc	se-3933051	se	ups_next_day_air_early_am	UPS	Ups Next Day Air Early Am	5031	UPS Ups Next Day Air Early Am	cmgzzea5200001vtaazq29pyk	2025-10-21 17:32:55.441	2025-10-21 17:32:55.441
cmh0ud213000jlsmittjat0rv	se-3933051	se	ups_3_day_select	UPS	Ups 3 Day Select	5030	UPS Ups 3 Day Select	cmgzzea5200001vtaazq29pyk	2025-10-21 17:31:47.463	2025-10-21 17:31:47.463
cmh0ucn10000hlsmizxi0e3nh	se-3933051	se	ups_2nd_day_air_am	UPS	Ups 2nd Day Air Am	5082	UPS Ups 2nd Day Air Am	cmgzzea5200001vtaazq29pyk	2025-10-21 17:31:28.02	2025-10-21 17:31:28.02
cmh0udio8000llsmi1xx1ql98	se-3933051	se	ups_ground	UPS	Ups Ground	5032	UPS Ups Ground	cmgzzea5200001vtaazq29pyk	2025-10-21 17:32:09.032	2025-10-21 17:32:09.032
cmh0u8wh30009lsmi8a68tv1x	se-3932358	se	fedex_priority_overnight	FedEx	Fedex Priority Overnight	5005	FedEx Fedex Priority Overnight	cmgzzea5200001vtaazq29pyk	2025-10-21 17:28:33.639	2025-10-21 17:28:33.639
cmh0uf1en000rlsmijghcxm6a	se-3933051	se	ups_next_day_air_saver	UPS	Ups Next Day Air Saver	5065	UPS Ups Next Day Air Saver	cmgzzea5200001vtaazq29pyk	2025-10-21 17:33:19.967	2025-10-21 17:33:19.967
cmh0u6he40003lsmi7ta9cled	se-3932358	se	fedex_2day	FedEx	Fedex 2day	5014	FedEx Fedex 2day	cmgzzea5200001vtaazq29pyk	2025-10-21 17:26:40.78	2025-10-21 17:26:40.78
cmh0u6x3d0005lsmievk8ipqr	se-3932358	se	fedex_express_saver	FedEx	Fedex Express Saver	5026	FedEx Fedex Express Saver	cmgzzea5200001vtaazq29pyk	2025-10-21 17:27:01.129	2025-10-21 17:27:01.129
cmh0u7ek80007lsmi5di9uvg3	se-3932358	se	fedex_home_delivery	FedEx	Fedex Home Delivery	5097	FedEx Fedex Home Delivery	cmgzzea5200001vtaazq29pyk	2025-10-21 17:27:23.768	2025-10-21 17:27:23.768
cmh0u5t9z0001lsmij5s4j6ti	se-3932358	se	fedex_ground	FedEx	Fedex Ground	5006	FedEx Fedex Ground	cmgzzea5200001vtaazq29pyk	2025-10-21 17:26:09.526	2025-10-21 17:26:09.526
cmh3sqhj50007vi7iow0srn8h	se-3932298	se	gls_us_priority_overnight	GLS	Gls Us Priority Overnight	5094	GLS Gls Us Priority Overnight	cmgzzea5200001vtaazq29pyk	2025-10-23 19:09:33.378	2025-10-23 19:09:33.378
cmh3sr7k80009vi7ibk53jxri	se-3932298	se	gls_us_ground	GLS	Gls Us Ground	5093	GLS Gls Us Ground	cmgzzea5200001vtaazq29pyk	2025-10-23 19:10:07.112	2025-10-23 19:10:07.112
\.


--
-- Data for Name: Integration; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Integration" (id, provider, enabled, config, "secretName", "tenantId", "createdAt", "updatedAt") FROM stdin;
cmgzzflfv0001cqkboq8nvgvi	shipstation	t	{"mode": "production", "carriers": [{"id": "se-3933051", "name": "UPS"}, {"id": "se-3932358", "name": "FedEx"}, {"id": "se-3932298", "name": "GLS"}], "carrierIds": ["se-3933051", "se-3932358", "se-3932298"], "defaultFromAddress": {"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}}	calitho-suite/integrations/shipstation/cmgzzea5200001vtaazq29pyk	cmgzzea5200001vtaazq29pyk	2025-10-21 03:05:57.834	2025-10-22 17:06:19.334
\.


--
-- Data for Name: InvoiceIntegration; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."InvoiceIntegration" (id, "invoiceNumber", status, payload, "netsuiteResponse", "netsuiteInvoiceId", "errorMessage", "retryCount", "maxRetries", "lastAttemptAt", "createdAt", "updatedAt", "sentToNetsuiteAt", "tenantId") FROM stdin;
cmh9deh0z001v8frznn1nk34i	56862	completed	{"invoice": {"id": 20922, "poNumber": "Not Applicable", "taxAmount": 0, "customerId": "CAL325", "invoiceNum": "56862", "invoiceDate": "2025-10-27", "customerName": "CALITHO", "invoiceAmount": 0}, "metadata": {"exportedAt": "2025-10-27 09:46:55", "objectType": "Invoice", "totalInvoiceExtras": 0, "totalSalesDistLines": 4}, "invoiceExtras": [], "salesDistributions": [{"id": 49758, "amount": 54.37, "invoice": "Invoice (56862) Job 113059 Part 01", "quantity": 1, "salesCategoryId": 5022, "salesCategoryName": "Digital"}, {"id": 49759, "amount": -111.89, "invoice": "Invoice (56862) Job 113059 Part 01", "quantity": 1, "salesCategoryId": 7010, "salesCategoryName": "IL: Print - General"}, {"id": 49760, "amount": 9.34, "invoice": "Invoice (56862) Job 113059 Part 01", "quantity": 1, "salesCategoryId": 5025, "salesCategoryName": "Finishing"}, {"id": 49761, "amount": 48.18, "invoice": "Invoice (56862) Job 113059 Part 01", "quantity": 1, "salesCategoryId": 5021, "salesCategoryName": "Prepress"}]}	{"message": "Invoice created successfully", "success": true, "customer": "CALITHO", "invoiceId": 334831, "totalAmount": 0, "invoiceNumber": "56862"}	334831	\N	0	3	2025-10-27 16:47:06.708	2025-10-27 16:46:55.667	2025-10-27 16:47:26.562	2025-10-27 16:47:26.56	cmgzzea5200001vtaazq29pyk
cmh5397x0000010j8mv7ppkg7	55849-1	completed	{"invoice": {"id": 19663, "poNumber": "29557", "taxAmount": 80, "customerId": "CLA504", "invoiceNum": "55849-1", "invoiceDate": "2025-10-24", "customerName": "CLAMP-SWING PRICING CO.", "invoiceAmount": 1550.04}, "metadata": {"exportedAt": "2025-10-24 09:51:49", "objectType": "Invoice", "totalInvoiceExtras": 2, "totalSalesDistLines": 5}, "invoiceExtras": [{"id": 12182, "price": 150, "lineNum": 1, "quantity": 1, "invoiceExtraTypeId": 6, "invoiceExtraTypeName": "Handling"}, {"id": 12183, "price": 1000, "lineNum": 2, "quantity": 1, "invoiceExtraTypeId": 1, "invoiceExtraTypeName": "Freight"}], "salesDistributions": [{"id": 44841, "amount": 55.74, "invoice": "Invoice (55849-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 7010, "salesCategoryName": "IL: Print - General"}, {"id": 44842, "amount": 5.2, "invoice": "Invoice (55849-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5025, "salesCategoryName": "Finishing"}, {"id": 44843, "amount": 153.1, "invoice": "Invoice (55849-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5024, "salesCategoryName": "Wide Format"}, {"id": 44844, "amount": 27, "invoice": "Invoice (55849-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5027, "salesCategoryName": "Shipping"}, {"id": 44845, "amount": 79, "invoice": "Invoice (55849-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5021, "salesCategoryName": "Prepress"}]}	{"message": "Invoice created successfully", "success": true, "customer": "CLAMP-SWING PRICING CO.", "invoiceId": 334032, "totalAmount": 1550.04, "invoiceNumber": "55849-1"}	334032	\N	6	3	2025-10-24 17:03:46.933	2025-10-24 16:51:49.717	2025-10-24 17:03:48.846	2025-10-24 17:03:48.844	cmgzzea5200001vtaazq29pyk
cmh54yprx000rx0zy5t53djkf	55850-1	completed	{"invoice": {"id": 19664, "poNumber": "29557", "taxAmount": 55, "customerId": "CLA504", "invoiceNum": "55850-2", "invoiceDate": "2025-10-24", "customerName": "CLAMP-SWING PRICING CO.", "invoiceAmount": 1425.04}, "metadata": {"exportedAt": "2025-10-24 10:39:38", "objectType": "Invoice", "totalInvoiceExtras": 2, "totalSalesDistLines": 5}, "invoiceExtras": [{"id": 12184, "price": 1000, "lineNum": 1, "quantity": 1, "invoiceExtraTypeId": 1, "invoiceExtraTypeName": "Freight"}, {"id": 12185, "price": 50, "lineNum": 2, "quantity": 1, "invoiceExtraTypeId": 6, "invoiceExtraTypeName": "Handling"}], "salesDistributions": [{"id": 44846, "amount": 55.74, "invoice": "Invoice (55850-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 7010, "salesCategoryName": "IL: Print - General"}, {"id": 44847, "amount": 5.2, "invoice": "Invoice (55850-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5025, "salesCategoryName": "Finishing"}, {"id": 44848, "amount": 153.1, "invoice": "Invoice (55850-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5024, "salesCategoryName": "Wide Format"}, {"id": 44849, "amount": 27, "invoice": "Invoice (55850-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5027, "salesCategoryName": "Shipping"}, {"id": 44850, "amount": 79, "invoice": "Invoice (55850-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5021, "salesCategoryName": "Prepress"}]}	{"message": "Invoice created successfully", "success": true, "customer": "CLAMP-SWING PRICING CO.", "invoiceId": 334231, "totalAmount": 1425.04, "invoiceNumber": "55850-2"}	334231	\N	0	3	2025-10-24 17:48:28.41	2025-10-24 17:39:38.878	2025-10-24 17:48:36.361	2025-10-24 17:48:36.359	cmgzzea5200001vtaazq29pyk
cmh586ct4000b2q4zboxxzfog	55853-1	completed	{"invoice": {"id": 19667, "poNumber": "29557", "taxAmount": 0, "customerId": "CLA504", "invoiceNum": "55853-1", "invoiceDate": "2025-10-24", "customerName": "CLAMP-SWING PRICING CO.", "invoiceAmount": 495.04}, "metadata": {"exportedAt": "2025-10-24 12:09:33", "objectType": "Invoice", "totalInvoiceExtras": 2, "totalSalesDistLines": 5}, "invoiceExtras": [{"id": 12190, "price": 150, "lineNum": 1, "quantity": 1, "invoiceExtraTypeId": 1, "invoiceExtraTypeName": "Freight"}, {"id": 12191, "price": 25, "lineNum": 2, "quantity": 1, "invoiceExtraTypeId": 6, "invoiceExtraTypeName": "Handling"}], "salesDistributions": [{"id": 44861, "amount": 55.74, "invoice": "Invoice (55853-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 7010, "salesCategoryName": "IL: Print - General"}, {"id": 44862, "amount": 5.2, "invoice": "Invoice (55853-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5025, "salesCategoryName": "Finishing"}, {"id": 44863, "amount": 153.1, "invoice": "Invoice (55853-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5024, "salesCategoryName": "Wide Format"}, {"id": 44864, "amount": 27, "invoice": "Invoice (55853-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5027, "salesCategoryName": "Shipping"}, {"id": 44865, "amount": 79, "invoice": "Invoice (55853-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5021, "salesCategoryName": "Prepress"}]}	{"message": "Invoice created successfully", "success": true, "customer": "CLAMP-SWING PRICING CO.", "invoiceId": 334431, "totalAmount": 495.04, "invoiceNumber": "55853-1"}	334431	\N	0	3	2025-10-24 19:09:34.774	2025-10-24 19:09:34.168	2025-10-24 19:09:42.375	2025-10-24 19:09:42.373	cmgzzea5200001vtaazq29pyk
cmh4c2xmv0005g2ycy6nqtji2	55686	completed	{"invoice": {"id": 200, "poNumber": "1000216476", "taxAmount": 4953.37, "customerId": "00001012", "invoiceNum": "15028001", "invoiceDate": "2025-10-22", "customerName": "Stanford Medicine", "invoiceAmount": 57502.95}, "metadata": {"exportedAt": "2025-10-23 21:11:06", "objectType": "Invoice", "totalInvoiceExtras": 2, "totalSalesDistLines": 6}, "invoiceExtras": [{"id": 12178, "price": 200, "lineNum": 1, "quantity": 1, "invoiceExtraTypeId": 1, "invoiceExtraTypeName": "Freight"}, {"id": 12179, "price": 200, "lineNum": 2, "quantity": 1, "invoiceExtraTypeId": 6, "invoiceExtraTypeName": "Handling"}], "salesDistributions": [{"id": 43905, "amount": 6011.27, "invoice": "Invoice (55686) Job 112300 Part 01", "quantity": 1, "salesCategoryId": 7010, "salesCategoryName": "IL: Print - General"}, {"id": 43906, "amount": 8952.59, "invoice": "Invoice (55686) Job 112300 Part 01", "quantity": 1, "salesCategoryId": 5025, "salesCategoryName": "Finishing"}, {"id": 43907, "amount": 36885.19, "invoice": "Invoice (55686) Job 112300 Part 01", "quantity": 1, "salesCategoryId": 5023, "salesCategoryName": "Offset"}, {"id": 43908, "amount": 65, "invoice": "Invoice (55686) Job 112300 Part 01", "quantity": 1, "salesCategoryId": 7018, "salesCategoryName": "IL: Freight"}, {"id": 43909, "amount": 231.53, "invoice": "Invoice (55686) Job 112300 Part 01", "quantity": 1, "salesCategoryId": 5027, "salesCategoryName": "Shipping"}, {"id": 43910, "amount": 4, "invoice": "Invoice (55686) Job 112300 Part 01", "quantity": 1, "salesCategoryId": 5021, "salesCategoryName": "Prepress"}]}	{"message": "Invoice created successfully", "success": true, "customer": "Stanford Medicine", "invoiceId": 333932, "totalAmount": 57502.95, "invoiceNumber": "15028001"}	333932	\N	19	3	2025-10-24 16:11:11.799	2025-10-24 04:11:06.823	2025-10-24 16:11:15.213	2025-10-24 16:11:15.211	cmgzzea5200001vtaazq29pyk
cmh56397m0015x0zytqw3gywl	55851-1	completed	{"invoice": {"id": 19665, "poNumber": "29557", "taxAmount": 125, "customerId": "CLA504", "invoiceNum": "55851-1", "invoiceDate": "2025-10-24", "customerName": "CLAMP-SWING PRICING CO.", "invoiceAmount": 595.04}, "metadata": {"exportedAt": "2025-10-24 11:11:10", "objectType": "Invoice", "totalInvoiceExtras": 2, "totalSalesDistLines": 5}, "invoiceExtras": [{"id": 12186, "price": 100, "lineNum": 1, "quantity": 1, "invoiceExtraTypeId": 1, "invoiceExtraTypeName": "Freight"}, {"id": 12187, "price": 50, "lineNum": 2, "quantity": 1, "invoiceExtraTypeId": 6, "invoiceExtraTypeName": "Handling"}], "salesDistributions": [{"id": 44851, "amount": 55.74, "invoice": "Invoice (55851-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 7010, "salesCategoryName": "IL: Print - General"}, {"id": 44852, "amount": 5.2, "invoice": "Invoice (55851-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5025, "salesCategoryName": "Finishing"}, {"id": 44853, "amount": 153.1, "invoice": "Invoice (55851-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5024, "salesCategoryName": "Wide Format"}, {"id": 44854, "amount": 27, "invoice": "Invoice (55851-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5027, "salesCategoryName": "Shipping"}, {"id": 44855, "amount": 79, "invoice": "Invoice (55851-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5021, "salesCategoryName": "Prepress"}]}	{"message": "Invoice created successfully", "success": true, "customer": "CLAMP-SWING PRICING CO.", "invoiceId": 334132, "totalAmount": 595.04, "invoiceNumber": "55851-1"}	334132	\N	0	3	2025-10-24 18:11:11	2025-10-24 18:11:10.306	2025-10-24 18:11:21.228	2025-10-24 18:11:21.227	cmgzzea5200001vtaazq29pyk
cmh566tsb0017x0zyn2nqy2f0	55852-1	completed	{"invoice": {"id": 19666, "poNumber": "29557", "taxAmount": 60, "customerId": "CLA504", "invoiceNum": "55852-1", "invoiceDate": "2025-10-24", "customerName": "CLAMP-SWING PRICING CO.", "invoiceAmount": 980.04}, "metadata": {"exportedAt": "2025-10-24 11:13:56", "objectType": "Invoice", "totalInvoiceExtras": 2, "totalSalesDistLines": 5}, "invoiceExtras": [{"id": 12188, "price": 500, "lineNum": 1, "quantity": 1, "invoiceExtraTypeId": 1, "invoiceExtraTypeName": "Freight"}, {"id": 12189, "price": 100, "lineNum": 2, "quantity": 1, "invoiceExtraTypeId": 6, "invoiceExtraTypeName": "Handling"}], "salesDistributions": [{"id": 44856, "amount": 55.74, "invoice": "Invoice (55852-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 7010, "salesCategoryName": "IL: Print - General"}, {"id": 44857, "amount": 5.2, "invoice": "Invoice (55852-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5025, "salesCategoryName": "Finishing"}, {"id": 44858, "amount": 153.1, "invoice": "Invoice (55852-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5024, "salesCategoryName": "Wide Format"}, {"id": 44859, "amount": 27, "invoice": "Invoice (55852-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5027, "salesCategoryName": "Shipping"}, {"id": 44860, "amount": 79, "invoice": "Invoice (55852-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5021, "salesCategoryName": "Prepress"}]}	{"message": "Invoice created successfully", "success": true, "customer": "CLAMP-SWING PRICING CO.", "invoiceId": 334331, "totalAmount": 980.04, "invoiceNumber": "55852-1"}	334331	\N	0	3	2025-10-24 18:13:57.165	2025-10-24 18:13:56.94	2025-10-24 18:14:04.419	2025-10-24 18:14:04.417	cmgzzea5200001vtaazq29pyk
cmh52dx670012f9g0d3wg6bb2	55848	completed	{"invoice": {"id": 19662, "poNumber": "29557", "taxAmount": 50, "customerId": "CLA504", "invoiceNum": "55848-1", "invoiceDate": "2025-10-24", "customerName": "CLAMP-SWING PRICING CO.", "invoiceAmount": 2070.04}, "metadata": {"exportedAt": "2025-10-24 09:27:29", "objectType": "Invoice", "totalInvoiceExtras": 2, "totalSalesDistLines": 5}, "invoiceExtras": [{"id": 12180, "price": 1500, "lineNum": 1, "quantity": 1, "invoiceExtraTypeId": 1, "invoiceExtraTypeName": "Freight"}, {"id": 12181, "price": 200, "lineNum": 2, "quantity": 1, "invoiceExtraTypeId": 6, "invoiceExtraTypeName": "Handling"}], "salesDistributions": [{"id": 44836, "amount": 55.74, "invoice": "Invoice (55848) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 7010, "salesCategoryName": "IL: Print - General"}, {"id": 44837, "amount": 5.2, "invoice": "Invoice (55848) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5025, "salesCategoryName": "Finishing"}, {"id": 44838, "amount": 153.1, "invoice": "Invoice (55848) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5024, "salesCategoryName": "Wide Format"}, {"id": 44839, "amount": 27, "invoice": "Invoice (55848) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5027, "salesCategoryName": "Shipping"}, {"id": 44840, "amount": 79, "invoice": "Invoice (55848) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5021, "salesCategoryName": "Prepress"}]}	{"message": "Invoice created successfully", "success": true, "customer": "CLAMP-SWING PRICING CO.", "invoiceId": 334031, "totalAmount": 2070.04, "invoiceNumber": "55848-1"}	334031	\N	0	3	2025-10-24 16:47:12.1	2025-10-24 16:27:29.455	2025-10-24 16:47:21.635	2025-10-24 16:47:21.634	cmgzzea5200001vtaazq29pyk
cmh5aiwcj00018ndoxbzryfom	55855-1	completed	{"invoice": {"id": 19670, "poNumber": "29557", "taxAmount": 2, "customerId": "CLA504", "invoiceNum": "55855-1", "invoiceDate": "2025-10-24", "customerName": "CLAMP-SWING PRICING CO.", "invoiceAmount": 222}, "metadata": {"exportedAt": "2025-10-24 13:15:18", "objectType": "Invoice", "totalInvoiceExtras": 1, "totalSalesDistLines": 5}, "invoiceExtras": [{"id": 12194, "price": 100, "lineNum": 1, "quantity": 1, "invoiceExtraTypeId": 1, "invoiceExtraTypeName": "Freight"}], "salesDistributions": [{"id": 44876, "amount": 20.9, "invoice": "Invoice (55855-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 7010, "salesCategoryName": "IL: Print - General"}, {"id": 44877, "amount": 1.95, "invoice": "Invoice (55855-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5025, "salesCategoryName": "Finishing"}, {"id": 44878, "amount": 57.41, "invoice": "Invoice (55855-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5024, "salesCategoryName": "Wide Format"}, {"id": 44879, "amount": 10.12, "invoice": "Invoice (55855-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5027, "salesCategoryName": "Shipping"}, {"id": 44880, "amount": 29.62, "invoice": "Invoice (55855-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5021, "salesCategoryName": "Prepress"}]}	{"message": "Invoice created successfully", "success": true, "customer": "CLAMP-SWING PRICING CO.", "invoiceId": 334531, "totalAmount": 222, "invoiceNumber": "55855-1"}	334531	\N	0	3	2025-10-24 20:15:29.246	2025-10-24 20:15:18.596	2025-10-24 20:15:37.284	2025-10-24 20:15:37.283	cmgzzea5200001vtaazq29pyk
cmh5aqbjt0001w84g467v18ov	55857-1	completed	{"invoice": {"id": 19671, "poNumber": "29557", "taxAmount": 0, "customerId": "CLA504", "invoiceNum": "55857-1", "invoiceDate": "2025-10-24", "customerName": "CLAMP-SWING PRICING CO.", "invoiceAmount": 820.0799999999999}, "metadata": {"exportedAt": "2025-10-24T20:21:05.061Z", "objectType": "Invoice", "paceInvoiceIds": [19672, 19671], "totalInvoiceExtras": 4, "totalSalesDistLines": 10}, "invoiceExtras": [{"id": 12195, "price": 100, "lineNum": 1, "quantity": 1, "invoiceExtraTypeId": 1, "invoiceExtraTypeName": "Freight"}, {"id": 12196, "price": 50, "lineNum": 2, "quantity": 1, "invoiceExtraTypeId": 6, "invoiceExtraTypeName": "Handling"}, {"id": 12197, "price": 25, "lineNum": 1, "quantity": 1, "invoiceExtraTypeId": 1, "invoiceExtraTypeName": "Freight"}, {"id": 12198, "price": 5, "lineNum": 2, "quantity": 1, "invoiceExtraTypeId": 6, "invoiceExtraTypeName": "Handling"}], "salesDistributions": [{"id": 44886, "amount": 55.74, "invoice": "Invoice (55857-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 7010, "salesCategoryName": "IL: Print - General"}, {"id": 44887, "amount": 5.2, "invoice": "Invoice (55857-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5025, "salesCategoryName": "Finishing"}, {"id": 44888, "amount": 153.1, "invoice": "Invoice (55857-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5024, "salesCategoryName": "Wide Format"}, {"id": 44889, "amount": 27, "invoice": "Invoice (55857-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5027, "salesCategoryName": "Shipping"}, {"id": 44890, "amount": 79, "invoice": "Invoice (55857-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5021, "salesCategoryName": "Prepress"}, {"id": 44881, "amount": 55.74, "invoice": "Invoice (55857-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 7010, "salesCategoryName": "IL: Print - General"}, {"id": 44882, "amount": 5.2, "invoice": "Invoice (55857-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5025, "salesCategoryName": "Finishing"}, {"id": 44883, "amount": 153.1, "invoice": "Invoice (55857-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5024, "salesCategoryName": "Wide Format"}, {"id": 44884, "amount": 27, "invoice": "Invoice (55857-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5027, "salesCategoryName": "Shipping"}, {"id": 44885, "amount": 79, "invoice": "Invoice (55857-1) Job 112387 Part 01", "quantity": 1, "salesCategoryId": 5021, "salesCategoryName": "Prepress"}]}	{"message": "Invoice created successfully", "success": true, "customer": "CLAMP-SWING PRICING CO.", "invoiceId": 334532, "totalAmount": 820.0799999999999, "invoiceNumber": "55857-1"}	334532	\N	0	3	2025-10-24 20:21:15.536	2025-10-24 20:21:04.889	2025-10-24 20:21:21.628	2025-10-24 20:21:21.627	cmgzzea5200001vtaazq29pyk
cmh5f8vei000dv8io20emlz05	56858	completed	{"invoice": {"id": 20918, "poNumber": "", "taxAmount": 0, "customerId": "00001176", "invoiceNum": "56858", "invoiceDate": "2025-10-24", "customerName": "GNTL Skin", "invoiceAmount": 7085}, "metadata": {"exportedAt": "2025-10-24 15:27:28", "objectType": "Invoice", "totalInvoiceExtras": 1, "totalSalesDistLines": 6}, "invoiceExtras": [{"id": 12751, "price": 270, "lineNum": null, "quantity": 1, "invoiceExtraTypeId": 1, "invoiceExtraTypeName": "Freight"}], "salesDistributions": [{"id": 49735, "amount": 137.09, "invoice": "Invoice (56858) Job 112838 Part 01", "quantity": 1, "salesCategoryId": 7010, "salesCategoryName": "IL: Print - General"}, {"id": 49736, "amount": 1939.23, "invoice": "Invoice (56858) Job 112838 Part 01", "quantity": 1, "salesCategoryId": 5025, "salesCategoryName": "Finishing"}, {"id": 49737, "amount": 3455.59, "invoice": "Invoice (56858) Job 112838 Part 01", "quantity": 1, "salesCategoryId": 5023, "salesCategoryName": "Offset"}, {"id": 49738, "amount": 65, "invoice": "Invoice (56858) Job 112838 Part 01", "quantity": 1, "salesCategoryId": 7018, "salesCategoryName": "IL: Freight"}, {"id": 49739, "amount": 1032.46, "invoice": "Invoice (56858) Job 112838 Part 01", "quantity": 1, "salesCategoryId": 5021, "salesCategoryName": "Prepress"}, {"id": 49740, "amount": 185.63, "invoice": "Invoice (56858) Job 112838 Part 01", "quantity": 1, "salesCategoryId": 5028, "salesCategoryName": "CAD"}]}	{"message": "Invoice created successfully", "success": true, "customer": "GNTL Skin", "invoiceId": 334731, "totalAmount": 7085, "invoiceNumber": "56858"}	334731	\N	0	3	2025-10-24 22:27:51.896	2025-10-24 22:27:28.89	2025-10-24 22:28:02.089	2025-10-24 22:28:02.088	cmgzzea5200001vtaazq29pyk
cmh5f8vj8000jv8iofjbul45r	56848A	completed	{"invoice": {"id": 20906, "poNumber": "29592", "taxAmount": 0, "customerId": "CLA504", "invoiceNum": "56848A", "invoiceDate": "2025-10-23", "customerName": "CLAMP-SWING PRICING CO.", "invoiceAmount": 2475.21}, "metadata": {"exportedAt": "2025-10-24 15:27:28", "objectType": "Invoice", "totalInvoiceExtras": 0, "totalSalesDistLines": 5}, "invoiceExtras": [], "salesDistributions": [{"id": 49667, "amount": 259.22, "invoice": "Invoice (56848A) Job 112976 Part 01", "quantity": 1, "salesCategoryId": 7010, "salesCategoryName": "IL: Print - General"}, {"id": 49668, "amount": 37.92, "invoice": "Invoice (56848A) Job 112976 Part 01", "quantity": 1, "salesCategoryId": 5025, "salesCategoryName": "Finishing"}, {"id": 49669, "amount": 1967.29, "invoice": "Invoice (56848A) Job 112976 Part 01", "quantity": 1, "salesCategoryId": 5024, "salesCategoryName": "Wide Format"}, {"id": 49670, "amount": 21.56, "invoice": "Invoice (56848A) Job 112976 Part 01", "quantity": 1, "salesCategoryId": 5027, "salesCategoryName": "Shipping"}, {"id": 49671, "amount": 189.22, "invoice": "Invoice (56848A) Job 112976 Part 01", "quantity": 1, "salesCategoryId": 5021, "salesCategoryName": "Prepress"}]}	{"message": "Invoice created successfully", "success": true, "customer": "CLAMP-SWING PRICING CO.", "invoiceId": 334632, "totalAmount": 2475.21, "invoiceNumber": "56848A"}	334632	\N	0	3	2025-10-24 22:28:02.256	2025-10-24 22:27:29.06	2025-10-24 22:28:06.326	2025-10-24 22:28:06.325	cmgzzea5200001vtaazq29pyk
cmh5f8vj7000hv8iodpg6z7ok	56848B	completed	{"invoice": {"id": 20908, "poNumber": "29595", "taxAmount": 0, "customerId": "CLA504", "invoiceNum": "56848B", "invoiceDate": "2025-10-23", "customerName": "CLAMP-SWING PRICING CO.", "invoiceAmount": 625}, "metadata": {"exportedAt": "2025-10-24 15:27:28", "objectType": "Invoice", "totalInvoiceExtras": 0, "totalSalesDistLines": 5}, "invoiceExtras": [], "salesDistributions": [{"id": 49677, "amount": 65.45, "invoice": "Invoice (56848B) Job 112976 Part 01", "quantity": 1, "salesCategoryId": 7010, "salesCategoryName": "IL: Print - General"}, {"id": 49678, "amount": 9.58, "invoice": "Invoice (56848B) Job 112976 Part 01", "quantity": 1, "salesCategoryId": 5025, "salesCategoryName": "Finishing"}, {"id": 49679, "amount": 496.75, "invoice": "Invoice (56848B) Job 112976 Part 01", "quantity": 1, "salesCategoryId": 5024, "salesCategoryName": "Wide Format"}, {"id": 49680, "amount": 5.44, "invoice": "Invoice (56848B) Job 112976 Part 01", "quantity": 1, "salesCategoryId": 5027, "salesCategoryName": "Shipping"}, {"id": 49681, "amount": 47.78, "invoice": "Invoice (56848B) Job 112976 Part 01", "quantity": 1, "salesCategoryId": 5021, "salesCategoryName": "Prepress"}]}	{"message": "Invoice created successfully", "success": true, "customer": "CLAMP-SWING PRICING CO.", "invoiceId": 334633, "totalAmount": 625, "invoiceNumber": "56848B"}	334633	\N	0	3	2025-10-24 22:28:06.438	2025-10-24 22:27:29.059	2025-10-24 22:28:09.456	2025-10-24 22:28:09.455	cmgzzea5200001vtaazq29pyk
cmh5f8vs4000pv8iog6pnmnmk	56860	completed	{"invoice": {"id": 20920, "poNumber": "1232", "taxAmount": 0, "customerId": "MAN400", "invoiceNum": "56860", "invoiceDate": "2025-10-24", "customerName": "MANE HAIRCARE LLC", "invoiceAmount": 1200.32}, "metadata": {"exportedAt": "2025-10-24 15:27:29", "objectType": "Invoice", "totalInvoiceExtras": 1, "totalSalesDistLines": 4}, "invoiceExtras": [{"id": 12752, "price": 81.32, "lineNum": null, "quantity": 1, "invoiceExtraTypeId": 1, "invoiceExtraTypeName": "Freight"}], "salesDistributions": [{"id": 49749, "amount": 110.2, "invoice": "Invoice (56860) Job 113126 Part 01", "quantity": 1, "salesCategoryId": 7010, "salesCategoryName": "IL: Print - General"}, {"id": 49750, "amount": 898.56, "invoice": "Invoice (56860) Job 113126 Part 01", "quantity": 1, "salesCategoryId": 5025, "salesCategoryName": "Finishing"}, {"id": 49751, "amount": 28.08, "invoice": "Invoice (56860) Job 113126 Part 01", "quantity": 1, "salesCategoryId": 5027, "salesCategoryName": "Shipping"}, {"id": 49752, "amount": 82.16, "invoice": "Invoice (56860) Job 113126 Part 01", "quantity": 1, "salesCategoryId": 5021, "salesCategoryName": "Prepress"}]}	{"message": "Invoice created successfully", "success": true, "customer": "MANE HAIRCARE LLC", "invoiceId": 334636, "totalAmount": 1200.32, "invoiceNumber": "56860"}	334636	\N	0	3	2025-10-24 22:28:30.559	2025-10-24 22:27:29.381	2025-10-24 22:28:34.99	2025-10-24 22:28:34.989	cmgzzea5200001vtaazq29pyk
cmh5f8vjg000lv8ioypgabvqj	56857	completed	{"invoice": {"id": 20917, "poNumber": "", "taxAmount": 0, "customerId": "00001176", "invoiceNum": "56857", "invoiceDate": "2025-10-24", "customerName": "GNTL Skin", "invoiceAmount": 5637}, "metadata": {"exportedAt": "2025-10-24 15:27:28", "objectType": "Invoice", "totalInvoiceExtras": 1, "totalSalesDistLines": 6}, "invoiceExtras": [{"id": 12750, "price": 200, "lineNum": null, "quantity": 1, "invoiceExtraTypeId": 1, "invoiceExtraTypeName": "Freight"}], "salesDistributions": [{"id": 49729, "amount": 237.55, "invoice": "Invoice (56857) Job 112837 Part 01", "quantity": 1, "salesCategoryId": 7010, "salesCategoryName": "IL: Print - General"}, {"id": 49730, "amount": 1574.7, "invoice": "Invoice (56857) Job 112837 Part 01", "quantity": 1, "salesCategoryId": 5025, "salesCategoryName": "Finishing"}, {"id": 49731, "amount": 2355.89, "invoice": "Invoice (56857) Job 112837 Part 01", "quantity": 1, "salesCategoryId": 5023, "salesCategoryName": "Offset"}, {"id": 49732, "amount": 65, "invoice": "Invoice (56857) Job 112837 Part 01", "quantity": 1, "salesCategoryId": 7018, "salesCategoryName": "IL: Freight"}, {"id": 49733, "amount": 894.48, "invoice": "Invoice (56857) Job 112837 Part 01", "quantity": 1, "salesCategoryId": 5021, "salesCategoryName": "Prepress"}, {"id": 49734, "amount": 309.38, "invoice": "Invoice (56857) Job 112837 Part 01", "quantity": 1, "salesCategoryId": 5028, "salesCategoryName": "CAD"}]}	{"message": "Invoice created successfully", "success": true, "customer": "GNTL Skin", "invoiceId": 334732, "totalAmount": 5637, "invoiceNumber": "56857"}	334732	\N	0	3	2025-10-24 22:28:15.743	2025-10-24 22:27:29.069	2025-10-24 22:28:18.511	2025-10-24 22:28:18.511	cmgzzea5200001vtaazq29pyk
cmh5f8vs6000rv8ioe1pkykx6	56859	completed	{"invoice": {"id": 20919, "poNumber": "", "taxAmount": 733.46, "customerId": "GLA804", "invoiceNum": "56859", "invoiceDate": "2025-10-23", "customerName": "GLAUCOMA RESEARCH FOUNDATION", "invoiceAmount": 9237.46}, "metadata": {"exportedAt": "2025-10-24 15:27:29", "objectType": "Invoice", "totalInvoiceExtras": 0, "totalSalesDistLines": 8}, "invoiceExtras": [], "salesDistributions": [{"id": 49741, "amount": 204.46, "invoice": "Invoice (56859) Job 112981 Part 01", "quantity": 1, "salesCategoryId": 5022, "salesCategoryName": "Digital"}, {"id": 49742, "amount": 887.36, "invoice": "Invoice (56859) Job 112981 Part 01", "quantity": 1, "salesCategoryId": 7010, "salesCategoryName": "IL: Print - General"}, {"id": 49743, "amount": 1217.56, "invoice": "Invoice (56859) Job 112981 Part 01", "quantity": 1, "salesCategoryId": 5025, "salesCategoryName": "Finishing"}, {"id": 49744, "amount": 480.44, "invoice": "Invoice (56859) Job 112981 Part 01", "quantity": 1, "salesCategoryId": 5026, "salesCategoryName": "Buyout"}, {"id": 49745, "amount": 4078.77, "invoice": "Invoice (56859) Job 112981 Part 01", "quantity": 1, "salesCategoryId": 5023, "salesCategoryName": "Offset"}, {"id": 49746, "amount": 65, "invoice": "Invoice (56859) Job 112981 Part 01", "quantity": 1, "salesCategoryId": 7018, "salesCategoryName": "IL: Freight"}, {"id": 49747, "amount": 39.19, "invoice": "Invoice (56859) Job 112981 Part 01", "quantity": 1, "salesCategoryId": 5027, "salesCategoryName": "Shipping"}, {"id": 49748, "amount": 1531.22, "invoice": "Invoice (56859) Job 112981 Part 01", "quantity": 1, "salesCategoryId": 5021, "salesCategoryName": "Prepress"}]}	{"message": "Invoice created successfully", "success": true, "customer": "GLAUCOMA RESEARCH FOUNDATION", "invoiceId": 334635, "totalAmount": 9237.46, "invoiceNumber": "56859"}	334635	\N	0	3	2025-10-24 22:28:24.427	2025-10-24 22:27:29.382	2025-10-24 22:28:30.447	2025-10-24 22:28:30.446	cmgzzea5200001vtaazq29pyk
cmh5f8v66000bv8iot5fmhh7v	56847	completed	{"invoice": {"id": 20905, "poNumber": "2392", "taxAmount": 0, "customerId": "CRA231", "invoiceNum": "56847", "invoiceDate": "2025-10-23", "customerName": "CRAFTED BRAND COMPANY, LLC", "invoiceAmount": 8372}, "metadata": {"exportedAt": "2025-10-24 15:27:28", "objectType": "Invoice", "totalInvoiceExtras": 0, "totalSalesDistLines": 5}, "invoiceExtras": [], "salesDistributions": [{"id": 49662, "amount": 13.4, "invoice": "Invoice (56847) Job 111822 Part 01", "quantity": 1, "salesCategoryId": 7010, "salesCategoryName": "IL: Print - General"}, {"id": 49663, "amount": 6090.1, "invoice": "Invoice (56847) Job 111822 Part 01", "quantity": 1, "salesCategoryId": 5025, "salesCategoryName": "Finishing"}, {"id": 49664, "amount": 2073.05, "invoice": "Invoice (56847) Job 111822 Part 01", "quantity": 1, "salesCategoryId": 5023, "salesCategoryName": "Offset"}, {"id": 49665, "amount": 46.67, "invoice": "Invoice (56847) Job 111822 Part 01", "quantity": 1, "salesCategoryId": 5027, "salesCategoryName": "Shipping"}, {"id": 49666, "amount": 148.78, "invoice": "Invoice (56847) Job 111822 Part 01", "quantity": 1, "salesCategoryId": 5021, "salesCategoryName": "Prepress"}]}	{"message": "Invoice created successfully", "success": true, "customer": "CRAFTED BRAND COMPANY, LLC", "invoiceId": 334631, "totalAmount": 8372, "invoiceNumber": "56847"}	334631	\N	0	3	2025-10-24 22:27:39.264	2025-10-24 22:27:28.59	2025-10-24 22:27:51.728	2025-10-24 22:27:51.727	cmgzzea5200001vtaazq29pyk
cmh5f8vj7000fv8ioa1ae74ss	56853	completed	{"invoice": {"id": 20911, "poNumber": "", "taxAmount": 90.58, "customerId": "PAT176", "invoiceNum": "56853", "invoiceDate": "2025-10-24", "customerName": "PATELCO CREDIT UNION", "invoiceAmount": 1602.13}, "metadata": {"exportedAt": "2025-10-24 15:27:28", "objectType": "Invoice", "totalInvoiceExtras": 1, "totalSalesDistLines": 6}, "invoiceExtras": [{"id": 12745, "price": 501.55, "lineNum": null, "quantity": 1, "invoiceExtraTypeId": 1, "invoiceExtraTypeName": "Freight"}], "salesDistributions": [{"id": 49693, "amount": 407.94, "invoice": "Invoice (56853) Job 113117 Part 01", "quantity": 1, "salesCategoryId": 5022, "salesCategoryName": "Digital"}, {"id": 49694, "amount": 172, "invoice": "Invoice (56853) Job 113117 Part 01", "quantity": 1, "salesCategoryId": 7010, "salesCategoryName": "IL: Print - General"}, {"id": 49695, "amount": 145.86, "invoice": "Invoice (56853) Job 113117 Part 01", "quantity": 1, "salesCategoryId": 5025, "salesCategoryName": "Finishing"}, {"id": 49696, "amount": 7.92, "invoice": "Invoice (56853) Job 113117 Part 01", "quantity": 1, "salesCategoryId": 7022, "salesCategoryName": "IL: Fulfill & Hand"}, {"id": 49697, "amount": 38.7, "invoice": "Invoice (56853) Job 113117 Part 01", "quantity": 1, "salesCategoryId": 5027, "salesCategoryName": "Shipping"}, {"id": 49698, "amount": 237.58, "invoice": "Invoice (56853) Job 113117 Part 01", "quantity": 1, "salesCategoryId": 5021, "salesCategoryName": "Prepress"}]}	{"message": "Invoice created successfully", "success": true, "customer": "PATELCO CREDIT UNION", "invoiceId": 334634, "totalAmount": 1602.13, "invoiceNumber": "56853"}	334634	\N	0	3	2025-10-24 22:28:09.566	2025-10-24 22:27:29.059	2025-10-24 22:28:15.631	2025-10-24 22:28:15.63	cmgzzea5200001vtaazq29pyk
cmh5f8vs4000nv8ioybbwwg50	56861	completed	{"invoice": {"id": 20921, "poNumber": "", "taxAmount": 0, "customerId": "MAR335", "invoiceNum": "56861", "invoiceDate": "2025-10-24", "customerName": "MARIN CLEAN ENERGY", "invoiceAmount": 210}, "metadata": {"exportedAt": "2025-10-24 15:27:29", "objectType": "Invoice", "totalInvoiceExtras": 0, "totalSalesDistLines": 5}, "invoiceExtras": [], "salesDistributions": [{"id": 49753, "amount": 14.76, "invoice": "Invoice (56861) Job 113122 Part 01", "quantity": 1, "salesCategoryId": 5025, "salesCategoryName": "Finishing"}, {"id": 49754, "amount": 1.28, "invoice": "Invoice (56861) Job 113122 Part 01", "quantity": 1, "salesCategoryId": 5026, "salesCategoryName": "Buyout"}, {"id": 49755, "amount": 155.77, "invoice": "Invoice (56861) Job 113122 Part 01", "quantity": 1, "salesCategoryId": 5031, "salesCategoryName": "Mailing"}, {"id": 49756, "amount": 28.19, "invoice": "Invoice (56861) Job 113122 Part 01", "quantity": 1, "salesCategoryId": 7017, "salesCategoryName": "IL: Direct Mail"}, {"id": 49757, "amount": 10, "invoice": "Invoice (56861) Job 113122 Part 01", "quantity": 1, "salesCategoryId": 5027, "salesCategoryName": "Shipping"}]}	{"message": "Invoice created successfully", "success": true, "customer": "MARIN CLEAN ENERGY", "invoiceId": 334733, "totalAmount": 210, "invoiceNumber": "56861"}	334733	\N	0	3	2025-10-24 22:28:18.675	2025-10-24 22:27:29.38	2025-10-24 22:28:24.316	2025-10-24 22:28:24.315	cmgzzea5200001vtaazq29pyk
\.


--
-- Data for Name: Job; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Job" (id, type, status, payload, result, error, progress, "createdAt", "updatedAt", "completedAt") FROM stdin;
\.


--
-- Data for Name: Membership; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Membership" (id, role, "userId", "tenantId", "createdAt", "updatedAt") FROM stdin;
cmh00ac4e000310q07pynlwy8	full_admin	cmh00absf000110q0p1ip6na3	cmh00abda000010q001zanzlt	2025-10-21 03:29:52.094	2025-10-21 03:29:52.094
cmh00acpu000610q0bfjx2j9z	full_admin	cmh00acib000410q0b27znmfv	cmh00abda000010q001zanzlt	2025-10-21 03:29:52.866	2025-10-21 03:29:52.866
cmh00ad6p000910q0oaf4fwj7	customer_service	cmh00acz8000710q0yhokvosp	cmh00abda000010q001zanzlt	2025-10-21 03:29:53.474	2025-10-21 03:29:53.474
cmgzzeaf300031vta19297j75	full_admin	cmgzzeaa500011vtanifj1f2k	cmgzzea5200001vtaazq29pyk	2025-10-21 03:04:56.896	2025-10-22 02:16:00.418
cmh1jimiw0002c5r6fe20p2b5	logistics	cmh1jimiw0000c5r673dqamec	cmgzzea5200001vtaazq29pyk	2025-10-22 05:15:57.704	2025-10-22 05:15:57.704
cmh1jjpif0007c5r6jm6a6idd	logistics	cmh1jjpif0005c5r6jgsufdqx	cmgzzea5200001vtaazq29pyk	2025-10-22 05:16:48.231	2025-10-22 05:16:48.231
cmh1jkqfh000cc5r6ka8lm9xa	admin	cmh1jkqfh000ac5r60bkksx2u	cmgzzea5200001vtaazq29pyk	2025-10-22 05:17:36.077	2025-10-22 05:17:36.077
cmh1jlf1d000hc5r6p4ip2ukb	admin	cmh1jlf1d000fc5r6i4lkjlgk	cmgzzea5200001vtaazq29pyk	2025-10-22 05:18:07.969	2025-10-22 05:18:07.969
cmh55e2jc000ux0zyov936ol8	logistics	cmh55e2jc000sx0zy1r291pqe	cmgzzea5200001vtaazq29pyk	2025-10-24 17:51:35.257	2025-10-24 17:51:35.257
cmh55fnpw000zx0zyjny32yj3	logistics	cmh55fnpw000xx0zyd5j4jdjf	cmgzzea5200001vtaazq29pyk	2025-10-24 17:52:49.364	2025-10-24 17:52:49.364
cmh5bfaf5000214mfdvxthtp5	estimators	cmh5bfaf4000014mfcss58x4x	cmgzzea5200001vtaazq29pyk	2025-10-24 20:40:29.825	2025-10-24 20:40:29.825
\.


--
-- Data for Name: MenuConfiguration; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."MenuConfiguration" (id, "menuKey", label, href, icon, "parentKey", "order", "visibleToRoles", "isActive", "tenantId", "createdAt", "updatedAt") FROM stdin;
cmh46invoice2	invoice-integrations	Invoice Integrations	/invoices/integrations	document	\N	4	{full_admin,admin,accounting}	t	cmh00abda000010q001zanzlt	2025-10-24 01:47:19.413	2025-10-24 01:47:19.413
cmh1d5p7v000bgy61xvfq1ggy	shipments	Shipments	/shipments	package	\N	3	{admin,customer_service,logistics,full_admin}	t	cmgzzea5200001vtaazq29pyk	2025-10-22 02:17:56.971	2025-10-25 20:31:04.168
cmh1d5p7v000fgy61g786vasq	batch-import	Batch Import	/batch-import	upload	\N	4	{full_admin,admin,logistics}	t	cmgzzea5200001vtaazq29pyk	2025-10-22 02:17:56.971	2025-10-25 20:31:04.168
cmh46invoice1	invoice-integrations	Invoice Integrations	/invoices/integrations	document	\N	5	{full_admin,admin,accounting}	t	cmgzzea5200001vtaazq29pyk	2025-10-24 01:47:19.243	2025-10-25 20:31:04.168
cmh1d5p7v000igy61zfdfidkk	rate-estimates	Rate Estimates	/rates/estimate	dollar	\N	6	{full_admin,admin,logistics,estimators}	t	cmgzzea5200001vtaazq29pyk	2025-10-22 02:17:56.971	2025-10-25 20:31:04.168
cmh1d5p7v000jgy61emew43ix	settings	Settings	/settings	settings	\N	7	{full_admin,admin}	t	cmgzzea5200001vtaazq29pyk	2025-10-22 02:17:56.971	2025-10-25 20:31:04.168
cmh1d5p7v000ggy61vw2u99k2	batch-import-new	New Import	/batch-import	plus	batch-import	1	{full_admin,admin,logistics}	t	cmgzzea5200001vtaazq29pyk	2025-10-22 02:17:56.971	2025-10-25 20:31:04.168
cmh1d5p7v000cgy61dwmy5wv3	shipments-all	All Shipments	/shipments	list	shipments	2	{admin,customer_service,logistics,full_admin}	t	cmgzzea5200001vtaazq29pyk	2025-10-22 02:17:56.971	2025-10-25 20:31:04.168
cmh1d5p7v000dgy61rqd3em28	shipments-manual-label	Manual Label	/shipments/manual-label	plus	shipments	4	{admin,customer_service,full_admin,logistics}	t	cmgzzea5200001vtaazq29pyk	2025-10-22 02:17:56.971	2025-10-25 20:31:04.168
cmh1d5p7v000hgy61asywggzp	batch-import-track	Track Batches	/batch-import/batches	search	batch-import	5	{full_admin,admin,logistics}	t	cmgzzea5200001vtaazq29pyk	2025-10-22 02:17:56.971	2025-10-25 20:31:04.168
cmh1d5p7v000egy61vfmu4sok	shipments-track	Track Labels	/shipment-track	search	shipments	6	{admin,customer_service,logistics,full_admin}	t	cmgzzea5200001vtaazq29pyk	2025-10-22 02:17:56.971	2025-10-25 20:31:04.168
cmh1d5p7v000agy61rm6w5jt2	dashboard	Dashboard	/dashboard	home	\N	0	{full_admin,admin,customer_service,estimators,logistics,accounting}	t	cmgzzea5200001vtaazq29pyk	2025-10-22 02:17:56.971	2025-10-25 20:31:04.168
cmh2xypox0003efc1yso98pu1	open-jobs	Open Jobs	/open-jobs	document	\N	1	{full_admin,admin,accounting}	t	cmgzzea5200001vtaazq29pyk	2025-10-23 04:48:09.105	2025-10-25 20:31:04.168
cmh5o64wg0001yxnzf65yh86k	prebilling-jobs	Prebilling Jobs	/prebilling-jobs	clipboard-check	\N	2	{full_admin,admin,customer_service,accounting}	t	cmgzzea5200001vtaazq29pyk	2025-10-25 02:37:17.776	2025-10-25 20:31:04.168
\.


--
-- Data for Name: NetSuiteIntegration; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."NetSuiteIntegration" (id, "sandboxEnabled", "productionEnabled", "currentMode", "tenantId", "createdAt", "updatedAt") FROM stdin;
cmh4eayrr0001mnytpznlvoh7	t	f	sandbox	cmgzzea5200001vtaazq29pyk	2025-10-24 05:13:20.775	2025-10-24 15:27:03.134
\.


--
-- Data for Name: Order; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Order" (id, "orderNumber", status, "customerName", "customerEmail", "customerPhone", subtotal, tax, total, currency, "shippingAddress", "billingAddress", notes, metadata, "tenantId", "createdAt", "updatedAt") FROM stdin;
cmh00adzg000b10q0gsv98tgc	ORD-00001	processing	Customer 1	customer1@example.com	+1-555-0001	100.00	10.00	110.00	USD	null	null	\N	null	cmh00abda000010q001zanzlt	2025-10-21 03:29:54.508	2025-10-21 03:29:54.508
cmh00aebr000f10q0lt6gfvf6	ORD-00002	shipped	Customer 2	customer2@example.com	+1-555-0002	200.00	20.00	220.00	USD	null	null	\N	null	cmh00abda000010q001zanzlt	2025-10-21 03:29:54.951	2025-10-21 03:29:54.951
cmh00aekq000j10q0n4d5p2a6	ORD-00003	pending	Customer 3	customer3@example.com	+1-555-0003	300.00	30.00	330.00	USD	null	null	\N	null	cmh00abda000010q001zanzlt	2025-10-21 03:29:55.275	2025-10-21 03:29:55.275
cmh00aetr000n10q0wgefph9g	ORD-00004	processing	Customer 4	customer4@example.com	+1-555-0004	400.00	40.00	440.00	USD	null	null	\N	null	cmh00abda000010q001zanzlt	2025-10-21 03:29:55.599	2025-10-21 03:29:55.599
cmh00af2q000r10q095awmcta	ORD-00005	shipped	Customer 5	customer5@example.com	+1-555-0005	500.00	50.00	550.00	USD	null	null	\N	null	cmh00abda000010q001zanzlt	2025-10-21 03:29:55.922	2025-10-21 03:29:55.922
\.


--
-- Data for Name: OrderItem; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."OrderItem" (id, sku, name, description, quantity, "unitPrice", total, metadata, "orderId", "createdAt", "updatedAt") FROM stdin;
cmh00adzg000c10q04d3m4ljc	SKU-1A	Product 1A	\N	1	50.00	50.00	null	cmh00adzg000b10q0gsv98tgc	2025-10-21 03:29:54.508	2025-10-21 03:29:54.508
cmh00adzg000d10q0nft7bn8p	SKU-1B	Product 1B	\N	1	50.00	50.00	null	cmh00adzg000b10q0gsv98tgc	2025-10-21 03:29:54.508	2025-10-21 03:29:54.508
cmh00aebr000g10q068kpvhtn	SKU-2A	Product 2A	\N	1	100.00	100.00	null	cmh00aebr000f10q0lt6gfvf6	2025-10-21 03:29:54.951	2025-10-21 03:29:54.951
cmh00aebr000h10q0j25qnpzs	SKU-2B	Product 2B	\N	1	100.00	100.00	null	cmh00aebr000f10q0lt6gfvf6	2025-10-21 03:29:54.951	2025-10-21 03:29:54.951
cmh00aekr000k10q0uzctu3qc	SKU-3A	Product 3A	\N	1	150.00	150.00	null	cmh00aekq000j10q0n4d5p2a6	2025-10-21 03:29:55.275	2025-10-21 03:29:55.275
cmh00aekr000l10q0d17nutjv	SKU-3B	Product 3B	\N	1	150.00	150.00	null	cmh00aekq000j10q0n4d5p2a6	2025-10-21 03:29:55.275	2025-10-21 03:29:55.275
cmh00aetr000o10q03bgpahf8	SKU-4A	Product 4A	\N	1	200.00	200.00	null	cmh00aetr000n10q0wgefph9g	2025-10-21 03:29:55.599	2025-10-21 03:29:55.599
cmh00aetr000p10q0o8nt4u6n	SKU-4B	Product 4B	\N	1	200.00	200.00	null	cmh00aetr000n10q0wgefph9g	2025-10-21 03:29:55.599	2025-10-21 03:29:55.599
cmh00af2q000s10q0r63q9oze	SKU-5A	Product 5A	\N	1	250.00	250.00	null	cmh00af2q000r10q095awmcta	2025-10-21 03:29:55.922	2025-10-21 03:29:55.922
cmh00af2q000t10q0zejy9mby	SKU-5B	Product 5B	\N	1	250.00	250.00	null	cmh00af2q000r10q095awmcta	2025-10-21 03:29:55.922	2025-10-21 03:29:55.922
\.


--
-- Data for Name: Session; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Session" (id, "sessionToken", "userId", expires) FROM stdin;
cmh9d1x0a001t8frzkk3bxb7p	jwt-cmgzzeaa500011vtanifj1f2k-1761583029850	cmgzzeaa500011vtanifj1f2k	2025-11-26 17:12:25.605
cmh5bgcq00001xen8f4foicve	jwt-cmh5bfaf4000014mfcss58x4x-1761338479463	cmh5bfaf4000014mfcss58x4x	2025-11-23 22:00:24.52
cmh5ieepc000h3c8rfnsr5quj	jwt-cmh55e2jc000sx0zy1r291pqe-1761350146031	cmh55e2jc000sx0zy1r291pqe	2025-11-24 00:00:48.468
cmh55p17c0013x0zypz3pqgbw	jwt-cmh55fnpw000xx0zyd5j4jdjf-1761328806743	cmh55fnpw000xx0zyd5j4jdjf	2025-11-24 00:48:47.712
cmh53pr8o00011014v520hqqm	jwt-cmh1jimiw0000c5r673dqamec-1761325481256	cmh1jimiw0000c5r673dqamec	2025-11-23 17:53:40.071
cmh9cfho5001p8frz70q234mb	jwt-cmh1jlf1d000fc5r6i4lkjlgk-1761581983540	cmh1jlf1d000fc5r6i4lkjlgk	2025-11-26 16:52:28.722
\.


--
-- Data for Name: ShipmentTypeMapping; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."ShipmentTypeMapping" (id, "plannedTypeId", "plannedTypeName", "completedTypeId", "completedTypeName", "tenantId", "createdAt", "updatedAt") FROM stdin;
cmgzzl0qs0007w96n3a7xr51s	201	Planned | Billable	202	Completed | Billable	cmgzzea5200001vtaazq29pyk	2025-10-21 03:10:10.948	2025-10-21 03:10:10.948
cmgzzldna0009w96n49h24dek	203	Planned | Not Billable	204	Completed | Not Billable	cmgzzea5200001vtaazq29pyk	2025-10-21 03:10:27.67	2025-10-21 03:10:27.67
cmgzzlpis000bw96nlm30d4r3	205	Planned | Storefront| Billable	206	Completed|Storefront| Billable	cmgzzea5200001vtaazq29pyk	2025-10-21 03:10:43.06	2025-10-21 03:10:43.06
cmh00aff0000v10q0kt1568ph	1	UPS Ground - Planned	2	UPS Ground - Completed	cmh00abda000010q001zanzlt	2025-10-21 03:29:56.365	2025-10-21 03:29:56.365
cmh00afi6000x10q07hq9r42j	3	UPS 2nd Day Air - Planned	4	UPS 2nd Day Air - Completed	cmh00abda000010q001zanzlt	2025-10-21 03:29:56.478	2025-10-21 03:29:56.478
cmh00afjp000z10q0p4jfemg4	5	UPS Next Day Air - Planned	6	UPS Next Day Air - Completed	cmh00abda000010q001zanzlt	2025-10-21 03:29:56.534	2025-10-21 03:29:56.534
cmh00afl9001110q06fbmks5t	7	FedEx Ground - Planned	8	FedEx Ground - Completed	cmh00abda000010q001zanzlt	2025-10-21 03:29:56.589	2025-10-21 03:29:56.589
cmh00afms001310q0jhiz99oz	9	USPS Priority - Planned	10	USPS Priority - Completed	cmh00abda000010q001zanzlt	2025-10-21 03:29:56.644	2025-10-21 03:29:56.644
\.


--
-- Data for Name: ShippingLabel; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."ShippingLabel" (id, "paceShipmentId", "paceCartonId", provider, "providerShipmentId", "providerLabelId", "trackingNumber", "labelUrl", "labelFormat", carrier, service, "shipFrom", "shipTo", weight, length, width, height, cost, currency, status, "voidedAt", "refundedAt", "isReturnLabel", "outboundLabelId", "rmaNumber", metadata, "tenantId", "createdAt", "updatedAt", "lastTrackedAt", "trackingStatus") FROM stdin;
cmh2itczv000ph33j7f4srxss	139073	153752	shipstation	se-159278489	se-73932848	394547095471	https://api.shipengine.com/v1/downloads/14/7aD71_8oEkWGNyyhyNr4uA/label-73932848.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "55414", "city": "MINNEAPOLIS", "name": "Soona / Ref # 412692", "email": "", "phone": "(000) 000-0000", "state": "MN", "company": "", "country": "US", "street1": "1621 E. Hennepin Ave.", "street2": "Suite 105"}	8.00	8.00	20.00	6.00	21.37	USD	voided	\N	\N	f	\N	\N	{"reference1": "112865 - CL139073", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-22 21:44:05.131	2025-10-22 21:45:06.667	\N	\N
cmh2j3cba000th33jtdw79kjx	139073	153753	shipstation	se-159282832	se-73934970	394547337514	https://api.shipengine.com/v1/downloads/14/fQfZbSEJrk-nJyVGw62_jg/label-73934970.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "55414", "city": "MINNEAPOLIS", "name": "Soona / Ref # 412692", "email": "", "phone": "(000) 000-0000", "state": "MN", "company": "", "country": "US", "street1": "1621 E. Hennepin Ave.", "street2": "Suite 105"}	8.00	8.00	20.00	6.00	21.37	USD	voided	\N	\N	f	\N	\N	{"reference1": "112865 - CL139073", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-22 21:51:50.806	2025-10-22 21:52:53.597	\N	\N
cmh2jrxe70001qtzgvbx56bxs	139979	153755	shipstation	se-159292813	se-73939108	394547861670	https://api.shipengine.com/v1/downloads/14/rt2p3NibH0yHsCHUpMCySA/label-73939108.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "55414", "city": "MINNEAPOLIS", "name": "Soona /", "email": "", "phone": "0000000000", "state": "MN", "company": "Soona / Ref # 412692", "country": "US", "street1": "1621 E. Hennepin Ave.", "street2": "Suite 105"}	10.00	10.00	20.00	6.00	21.37	USD	voided	\N	\N	f	\N	\N	{"reference1": "1 - CL139979", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-22 22:10:57.871	2025-10-22 22:13:34.272	\N	\N
cmh2kbg2z0005qtzgo03edoi6	139073	153758	shipstation	se-159299917	se-73941699	394548239381	https://api.shipengine.com/v1/downloads/14/9csb1Ow3u0ilJclhtl5rqg/label-73941699.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "55414", "city": "MINNEAPOLIS", "name": "Soona /", "email": "", "phone": "0000000000", "state": "MN", "company": "Soona / Ref # 412692", "country": "US", "street1": "1621 E. Hennepin Ave.", "street2": "Suite 105"}	10.00	10.00	\N	\N	0.00	USD	voided	\N	\N	f	\N	\N	{"reference1": "112865 - CL139073", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-22 22:26:08.555	2025-10-22 22:27:11.002	\N	\N
cmh2jxiad0003qtzgv4wsygux	139979	153756	shipstation	se-159294689	se-73939824	394547970174	https://api.shipengine.com/v1/downloads/14/kA7I2OZeoUWx3GZ7FXlVZQ/label-73939824.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "55414", "city": "MINNEAPOLIS", "name": "Soona /", "email": "", "phone": "0000000000", "state": "MN", "company": "Soona / Ref # 412692", "country": "US", "street1": "1621 E. Hennepin Ave.", "street2": "Suite 105"}	1.00	1.00	10.00	10.00	0.00	USD	voided	\N	\N	f	\N	\N	{"reference1": "1 - CL139979", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-22 22:15:18.229	2025-10-22 22:35:53.671	\N	\N
cmh2kpt1w0007qtzg9g90uqgg	139979	153764	shipstation	se-159305296	se-73943514	394548503389	https://api.shipengine.com/v1/downloads/14/EXuN61wfLkKykYNffifKuA/label-73943514.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "55414", "city": "MINNEAPOLIS", "name": "Soona /", "email": "", "phone": "0000000000", "state": "MN", "company": "Soona / Ref # 412692", "country": "US", "street1": "1621 E. Hennepin Ave.", "street2": "Suite 105"}	10.00	10.00	\N	\N	0.00	USD	voided	\N	\N	f	\N	\N	{"reference1": "1 - CL139979", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-22 22:37:18.549	2025-10-22 22:37:54.908	\N	\N
cmh2ku48i000vh33jeyzr3ekn	139978	153765	shipstation	se-159306764	se-73943950	1Z9634841394115199	https://api.shipengine.com/v1/downloads/14/-kkEj-aINESDcVw3khyxOA/label-73943950.pdf	pdf	UPS	UPS Next Day Air Saver®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "94602", "city": "Oakland", "name": "Maxine Ressler", "email": "", "phone": "", "state": "CA", "company": "", "country": "US", "street1": "2615 Madeline Street", "street2": ""}	1.00	1.00	11.00	2.00	17.94	USD	delivered	\N	\N	f	\N	\N	{"tracking": {"ship_date": "2025-10-22T22:52:18Z", "last_event": {"event_code": "D", "description": "Delivered", "occurred_at": "2025-10-24T00:29:44Z", "postal_code": "94602", "country_code": "US", "city_locality": "OAKLAND", "state_province": "CA", "event_description": "Delivered", "carrier_occurred_at": "2025-10-23T17:29:44Z"}, "updated_at": "2025-10-24T00:31:11.279Z", "status_code": "DE", "status_description": "Delivered", "carrier_status_code": "D", "actual_delivery_date": "2025-10-24T00:29:44Z", "exception_description": null, "estimated_delivery_date": "2025-10-23T00:00:00Z", "carrier_status_description": "Delivered"}}	cmgzzea5200001vtaazq29pyk	2025-10-22 22:40:39.666	2025-10-24 00:31:11.28	2025-10-24 00:31:11.279	delivered
cmh4048sf0005ti60cey5jgwd	139584	153807	shipstation	se-159905702	se-74265323	1Z9634841395208060	https://api.shipengine.com/v1/downloads/14/eM-J-4UTe0e2hXX4CsBoBQ/label-74265323.pdf	pdf	UPS	UPS Next Day Air Saver®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "10001", "city": "New York", "name": "Katherine Lord", "email": "", "phone": "", "state": "NY", "company": "Rothy's", "country": "US", "street1": "236 5th Ave, 10th Floor", "street2": ""}	19.00	19.00	21.00	12.00	66.96	USD	voided	\N	\N	f	\N	\N	{"reference1": "112922 - CL139584", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-23 22:36:12.544	2025-10-23 22:49:25.16	\N	\N
cmh40490y0007ti60maqzztz9	139584	153808	shipstation	se-159905702	se-74265323	1Z9634841397320676	https://api.shipengine.com/v1/downloads/14/eM-J-4UTe0e2hXX4CsBoBQ/label-74265323.pdf	pdf	UPS	UPS Next Day Air Saver®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "10001", "city": "New York", "name": "Katherine Lord", "email": "", "phone": "", "state": "NY", "company": "Rothy's", "country": "US", "street1": "236 5th Ave, 10th Floor", "street2": ""}	19.00	19.00	21.00	12.00	66.96	USD	voided	\N	\N	f	\N	\N	{"reference1": "112922 - CL139584", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-23 22:36:12.85	2025-10-23 22:49:26.156	\N	\N
cmh40499d0009ti60tnu6qowo	139584	153809	shipstation	se-159905702	se-74265323	1Z9634841398348289	https://api.shipengine.com/v1/downloads/14/eM-J-4UTe0e2hXX4CsBoBQ/label-74265323.pdf	pdf	UPS	UPS Next Day Air Saver®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "10001", "city": "New York", "name": "Katherine Lord", "email": "", "phone": "", "state": "NY", "company": "Rothy's", "country": "US", "street1": "236 5th Ave, 10th Floor", "street2": ""}	19.00	19.00	21.00	12.00	66.96	USD	voided	\N	\N	f	\N	\N	{"reference1": "112922 - CL139584", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-23 22:36:13.153	2025-10-23 22:49:26.891	\N	\N
cmh4048ih0003ti606iwu8ddk	139584	153806	shipstation	se-159905702	se-74265323	1Z9634841399510458	https://api.shipengine.com/v1/downloads/14/eM-J-4UTe0e2hXX4CsBoBQ/label-74265323.pdf	pdf	UPS	UPS Next Day Air Saver®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "10001", "city": "New York", "name": "Katherine Lord", "email": "", "phone": "", "state": "NY", "company": "Rothy's", "country": "US", "street1": "236 5th Ave, 10th Floor", "street2": ""}	19.00	19.00	21.00	12.00	66.96	USD	voided	\N	\N	f	\N	\N	{"tracking": {"ship_date": null, "last_event": {"event_code": "M", "description": "Shipper created a label, UPS has not received the package yet.", "occurred_at": "2025-10-23T22:36:10Z", "postal_code": "", "country_code": "US", "city_locality": "", "state_province": "", "event_description": "Shipper created a label, UPS has not received the package yet.", "carrier_occurred_at": "2025-10-23T15:36:10"}, "updated_at": "2025-10-23T22:37:39.293Z", "status_code": "AC", "status_description": "Accepted", "carrier_status_code": "M", "actual_delivery_date": null, "exception_description": null, "estimated_delivery_date": "2025-10-24T00:00:00", "carrier_status_description": "Shipper created a label, UPS has not received the package yet."}, "reference1": "112922 - CL139584", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-23 22:36:12.186	2025-10-23 22:49:24.153	2025-10-23 22:37:39.293	accepted
cmh405eyn000bti60u3nc0qbg	139584	153810	shipstation	se-159906051	se-74265505	1Z9634841395790896	https://api.shipengine.com/v1/downloads/14/nipRm6HEeEery-DQU6HLyg/label-74265505.pdf	pdf	UPS	UPS Next Day Air Saver®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "10001", "city": "New York", "name": "Katherine Lord", "email": "", "phone": "", "state": "NY", "company": "Rothy's", "country": "US", "street1": "236 5th Ave, 10th Floor", "street2": ""}	19.00	19.00	21.00	12.00	66.96	USD	voided	\N	\N	f	\N	\N	{"tracking": {"ship_date": null, "last_event": {"event_code": "M", "description": "Shipper created a label, UPS has not received the package yet.", "occurred_at": "2025-10-23T22:37:06Z", "postal_code": "", "country_code": "US", "city_locality": "", "state_province": "", "event_description": "Shipper created a label, UPS has not received the package yet.", "carrier_occurred_at": "2025-10-23T15:37:06"}, "updated_at": "2025-10-23T22:38:37.062Z", "status_code": "AC", "status_description": "Accepted", "carrier_status_code": "M", "actual_delivery_date": null, "exception_description": null, "estimated_delivery_date": "2025-10-24T00:00:00", "carrier_status_description": "Shipper created a label, UPS has not received the package yet."}, "reference1": "112922 - CL139584", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-23 22:37:07.2	2025-10-23 22:49:27.676	2025-10-23 22:38:37.062	accepted
cmh54xkce000bx0zy4eg1jyf3	140327	154169	shipstation	se-160339512	se-74475871	394615601004	https://api.shipengine.com/v1/downloads/14/AFL0mKdhSkqV0lL-ALjYVQ/label-74475871.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "94523", "city": "Pleasant Hill", "name": "Andrew Macdonald", "email": "mac@uber.com", "phone": "(415) 519-4327", "state": "CA", "company": "2431117-Uber Technologies, Inc.", "country": "US", "street1": "206 Steven Circle", "street2": ""}	1.00	1.00	8.00	4.00	0.00	USD	voided	\N	\N	f	\N	\N	{"reference1": "113015 - CL140327", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 17:38:45.183	2025-10-24 18:33:19.119	\N	\N
cmh54xkkx000dx0zydpooxr4w	140327	154170	shipstation	se-160339512	se-74475871	394615602250	https://api.shipengine.com/v1/downloads/14/AFL0mKdhSkqV0lL-ALjYVQ/label-74475871.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "94523", "city": "Pleasant Hill", "name": "Andrew Macdonald", "email": "mac@uber.com", "phone": "(415) 519-4327", "state": "CA", "company": "2431117-Uber Technologies, Inc.", "country": "US", "street1": "206 Steven Circle", "street2": ""}	1.00	1.00	8.00	4.00	0.00	USD	voided	\N	\N	f	\N	\N	{"reference1": "113015 - CL140327", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 17:38:45.49	2025-10-24 18:33:20.086	\N	\N
cmh54xktj000fx0zyvmloc7f1	140327	154171	shipstation	se-160339512	se-74475871	394615603864	https://api.shipengine.com/v1/downloads/14/AFL0mKdhSkqV0lL-ALjYVQ/label-74475871.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "94523", "city": "Pleasant Hill", "name": "Andrew Macdonald", "email": "mac@uber.com", "phone": "(415) 519-4327", "state": "CA", "company": "2431117-Uber Technologies, Inc.", "country": "US", "street1": "206 Steven Circle", "street2": ""}	1.00	1.00	8.00	4.00	0.00	USD	voided	\N	\N	f	\N	\N	{"reference1": "113015 - CL140327", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 17:38:45.799	2025-10-24 18:33:21.008	\N	\N
cmh2l28lv000zh33j19y47tsw	139976	153767	shipstation	se-159309256	se-73944782	1Z9634841399247181	https://api.shipengine.com/v1/downloads/14/gsfjS8UtJkO1t0J_sVgFug/label-73944782.pdf	pdf	UPS	UPS Next Day Air Saver®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "94558", "city": "Napa", "name": "Maggie Minnick", "email": "", "phone": "7079630134", "state": "CA", "company": "Maggie Minnick", "country": "US", "street1": "1175 El Centro Avenue", "street2": ""}	1.00	1.00	11.00	2.00	21.41	USD	delivered	\N	\N	f	\N	\N	{"tracking": {"ship_date": "2025-10-22T22:52:18Z", "last_event": {"event_code": "D", "description": "Delivered", "occurred_at": "2025-10-23T18:01:43Z", "postal_code": "94558", "country_code": "US", "city_locality": "NAPA", "state_province": "CA", "event_description": "Delivered", "carrier_occurred_at": "2025-10-23T11:01:43Z"}, "updated_at": "2025-10-23T18:03:32.664Z", "status_code": "DE", "status_description": "Delivered", "carrier_status_code": "D", "actual_delivery_date": "2025-10-23T18:01:43Z", "exception_description": null, "estimated_delivery_date": "2025-10-23T00:00:00Z", "carrier_status_description": "Delivered"}, "reference1": "113032 - CL139976", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-22 22:46:58.579	2025-10-23 18:03:32.666	2025-10-23 18:03:32.665	delivered
cmh2ky6tu000xh33jexln04ft	139977	153766	shipstation	se-159308068	se-73944355	1Z9634841399869572	https://api.shipengine.com/v1/downloads/14/VHJltTpFpkWffC6M2sMw9Q/label-73944355.pdf	pdf	UPS	UPS Next Day Air Saver®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "94952", "city": "Petaluma", "name": "Madeleine Corson", "email": "madeleine@corsondesign.com", "phone": "4157772492", "state": "CA", "company": "Corson Design", "country": "US", "street1": "405 Gericke Rd", "street2": ""}	1.00	1.00	11.00	2.00	21.41	USD	delivered	\N	\N	f	\N	\N	{"tracking": {"ship_date": "2025-10-22T22:52:18Z", "last_event": {"event_code": "D", "description": "Delivered", "occurred_at": "2025-10-23T18:03:00Z", "postal_code": "94952", "country_code": "US", "city_locality": "PETALUMA", "state_province": "CA", "event_description": "Delivered", "carrier_occurred_at": "2025-10-23T11:03:00Z"}, "updated_at": "2025-10-23T18:05:11.013Z", "status_code": "DE", "status_description": "Delivered", "carrier_status_code": "D", "actual_delivery_date": "2025-10-23T18:03:00Z", "exception_description": null, "estimated_delivery_date": "2025-10-23T00:00:00Z", "carrier_status_description": "Delivered"}}	cmgzzea5200001vtaazq29pyk	2025-10-22 22:43:49.651	2025-10-23 18:05:11.014	2025-10-23 18:05:11.013	delivered
cmh2hlpi4000lh33jkpxds3he	139954	153750	shipstation	se-159261107	se-73924398	1Z9634840190659177	https://api.shipengine.com/v1/downloads/14/A3vWqZFCVkWlUDzyUlIVJQ/label-73924398.pdf	pdf	UPS	UPS Next Day Air®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "95834", "city": "SACRAMENTO", "name": "MELANIE WARD", "email": "", "phone": "0000000000", "state": "CA", "company": "WIKOFF COLOR CORPORATION", "country": "US", "street1": "1329 N. MARKET BLVD.", "street2": "SUITE 160"}	1.00	1.00	10.00	1.00	16.80	USD	delivered	\N	\N	f	\N	\N	{"tracking": {"ship_date": "2025-10-22T21:10:07Z", "last_event": {"event_code": "D", "description": "Commercial Inside Release", "occurred_at": "2025-10-23T17:06:22Z", "postal_code": "95834", "country_code": "US", "city_locality": "SACRAMENTO", "state_province": "CA", "event_description": "Commercial Inside Release", "carrier_occurred_at": "2025-10-23T10:06:22Z"}, "updated_at": "2025-10-23T17:10:24.060Z", "status_code": "DE", "status_description": "Delivered", "carrier_status_code": "D", "actual_delivery_date": "2025-10-23T17:06:22Z", "exception_description": null, "estimated_delivery_date": "2025-10-23T00:00:00Z", "carrier_status_description": "Commercial Inside Release"}, "reference1": "1 - CL139954", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-22 21:10:08.476	2025-10-23 17:10:24.061	2025-10-23 17:10:24.06	delivered
cmh2huoy0000nh33jewlhq9l5	139957	153751	shipstation	se-159265066	se-73926193	1Z9634840191681186	https://api.shipengine.com/v1/downloads/14/ClGm-5SoukmYsz0yo60q7A/label-73926193.pdf	pdf	UPS	UPS Next Day Air®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "84048", "city": "LEHI", "name": "BRITTANY RHODES", "email": "evelyne@calitho.com", "phone": "0000000000", "state": "UT", "company": "FOUNT SOCIETY", "country": "US", "street1": "3401 North Thanksgiving Way", "street2": "Suite 300"}	1.00	1.00	10.00	1.00	18.78	USD	delivered	\N	\N	f	\N	\N	{"tracking": {"ship_date": "2025-10-22T22:52:18Z", "last_event": {"event_code": "D", "description": "Commercial Inside Release", "occurred_at": "2025-10-23T15:46:08Z", "postal_code": "84048", "country_code": "US", "city_locality": "LEHI", "state_province": "UT", "event_description": "Commercial Inside Release", "carrier_occurred_at": "2025-10-23T09:46:08Z"}, "updated_at": "2025-10-23T15:53:50.848Z", "status_code": "DE", "status_description": "Delivered", "carrier_status_code": "D", "actual_delivery_date": "2025-10-23T15:46:08Z", "exception_description": null, "estimated_delivery_date": "2025-10-23T00:00:00Z", "carrier_status_description": "Commercial Inside Release"}}	cmgzzea5200001vtaazq29pyk	2025-10-22 21:17:07.656	2025-10-23 15:53:50.849	2025-10-23 15:53:50.848	delivered
cmh3sdd430001mke2eti4gdbc	140008	153798	shipstation	se-159778613	se-74196070	394580770682	https://api.shipengine.com/v1/downloads/14/97Z1IulP9EuKs0gKqlFIEg/label-74196070.pdf	\N	se-3932358	fedex_ground	"{\\"zip\\":\\"94520\\",\\"city\\":\\"Concord\\",\\"name\\":\\"Shipping Manager\\",\\"phone\\":\\"9256821111\\",\\"state\\":\\"CA\\",\\"company\\":\\"Calitho\\",\\"country\\":\\"US\\",\\"street1\\":\\"2312 Stanwell Dr\\",\\"street2\\":\\"\\"}"	{"name": "Store Manager", "phone": "1111111111", "postal_code": "95391", "company_name": "Safeway - Store/Club #55", "country_code": "US", "address_line1": "19555 S. Mountain House Pkwy", "address_line2": null, "city_locality": "Mountain House", "state_province": "CA"}	10.00	10.00	10.00	2.00	0.00	USD	voided	\N	\N	f	\N	\N	{"jobNumber": "1", "reference1": "Safeway - CL121728", "reference2": "Safeway - CL121728", "reference3": "J112197-A1", "batchImportId": "cmh3sd9vk0004vi7inzdv6p8h", "packageNumber": 1, "totalPackages": 1, "batchImportRowId": "cmh3sd9vk0005vi7ims5sc47u"}	cmgzzea5200001vtaazq29pyk	2025-10-23 18:59:21.123	2025-10-23 19:00:21.73	\N	\N
cmh54xljb000lx0zy3xq27lbc	140327	154174	shipstation	se-160339512	se-74475871	394615605628	https://api.shipengine.com/v1/downloads/14/AFL0mKdhSkqV0lL-ALjYVQ/label-74475871.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "94523", "city": "Pleasant Hill", "name": "Andrew Macdonald", "email": "mac@uber.com", "phone": "(415) 519-4327", "state": "CA", "company": "2431117-Uber Technologies, Inc.", "country": "US", "street1": "206 Steven Circle", "street2": ""}	1.00	1.00	8.00	4.00	0.00	USD	voided	\N	\N	f	\N	\N	{"reference1": "113015 - CL140327", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 17:38:46.728	2025-10-24 18:33:23.458	\N	\N
cmh57lw1a00012q4z5gyf35dc	140012	154485	shipstation	se-160398559	se-74509582	1Z9634840398954115	https://api.shipengine.com/v1/downloads/14/CgiAgJPzxkmrxLxf0l-Rxw/label-74509582.pdf	pdf	UPS	UPS® Ground	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "90020", "city": "Los Angeles", "name": "NICOLE HAN", "email": "nicole.han@lghnhusa.com", "phone": "(909)3482-2692", "state": "CA", "company": "LG H&H USA", "country": "US", "street1": "515 SHATTO PLACE", "street2": ""}	21.00	21.00	12.00	12.00	12.63	USD	active	\N	\N	f	\N	\N	{"tracking": {"ship_date": "2025-10-24T00:00:00", "last_event": {"event_code": "I", "description": "Arrived at Facility", "occurred_at": "2025-10-25T16:47:00Z", "postal_code": "", "country_code": "US", "city_locality": "Sylmar", "state_province": "CA", "event_description": "Arrived at Facility", "carrier_occurred_at": "2025-10-25T09:47:00"}, "updated_at": "2025-10-27T17:02:06.574Z", "status_code": "IT", "status_description": "In Transit", "carrier_status_code": "I", "actual_delivery_date": null, "exception_description": null, "estimated_delivery_date": "2025-10-28T00:00:00", "carrier_status_description": "Arrived at Facility"}, "reference1": "112778 - CL140012", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 18:53:39.31	2025-10-27 17:02:06.575	2025-10-27 17:02:06.574	in_transit
cmh54xlrq000nx0zywrtkabpc	140327	154175	shipstation	se-160339512	se-74475871	394615605672	https://api.shipengine.com/v1/downloads/14/AFL0mKdhSkqV0lL-ALjYVQ/label-74475871.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "94523", "city": "Pleasant Hill", "name": "Andrew Macdonald", "email": "mac@uber.com", "phone": "(415) 519-4327", "state": "CA", "company": "2431117-Uber Technologies, Inc.", "country": "US", "street1": "206 Steven Circle", "street2": ""}	1.00	1.00	8.00	4.00	0.00	USD	voided	\N	\N	f	\N	\N	{"reference1": "113015 - CL140327", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 17:38:47.03	2025-10-24 18:33:24.42	\N	\N
cmh6r4elb0007otpu3ykx0caw	139044	154748	shipstation	se-161006212	se-74648332	394640137984	https://api.shipengine.com/v1/downloads/14/1Q0qJzNNsEe0JyMbiySf4Q/label-74648332.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "43125", "city": "Groveport", "name": "", "email": "jennifer.holmes@kachava.com", "phone": "(415) 699-1129", "state": "OH", "company": "ODW Logistics", "country": "US", "street1": "5465 Centerpoint Parkway", "street2": ""}	5.00	5.00	10.00	10.00	15.01	USD	voided	\N	\N	f	\N	\N	{"reference1": "113184 - CL139044", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-25 20:47:42.047	2025-10-25 20:54:31.429	\N	\N
cmh6r4cew0005otpug59zau8f	139044	\N	shipstation	se-161006221	se-74648336	797699508524	https://api.shipengine.com/v1/downloads/14/3VlnPDqhy0auWw7dXISsOg/label-74648336.pdf	\N	FedEx	FedEx Standard Overnight®	{"zip": "43125", "city": "Groveport", "name": "", "email": "jennifer.holmes@kachava.com", "phone": "(415) 699-1129", "state": "OH", "company": "ODW Logistics", "country": "US", "street1": "5465 Centerpoint Parkway", "street2": ""}	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	\N	\N	\N	\N	78.87	usd	voided	\N	\N	t	se-74648332	\N	{"tracking": {"ship_date": null, "last_event": {"event_code": "OC", "description": "Shipment information sent to FedEx", "occurred_at": "2025-10-25T13:47:37Z", "postal_code": null, "country_code": null, "city_locality": null, "state_province": null, "event_description": "Shipment information sent to FedEx", "carrier_occurred_at": "2025-10-25T13:47:37-07:00"}, "updated_at": "2025-10-25T20:48:59.793Z", "status_code": "AC", "status_description": "Accepted", "carrier_status_code": "OC", "actual_delivery_date": null, "exception_description": null, "estimated_delivery_date": null, "carrier_status_description": "Shipment information sent to FedEx"}}	cmgzzea5200001vtaazq29pyk	2025-10-25 20:47:39.223	2025-10-25 20:54:31.886	2025-10-25 20:48:59.793	accepted
cmh54tfjm0001x0zyfc4ftuya	140326	154164	shipstation	se-160337564	se-74474332	394615445008	https://api.shipengine.com/v1/downloads/14/G7TWCflmCkCu1yX-dCi4wg/label-74474332.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "94103", "city": "San Francisco", "name": "Tony Camberos", "email": "tony.camberos@uber.com", "phone": "(415) 740-5138", "state": "CA", "company": "2428963-Uber Technologies, Inc.", "country": "US", "street1": "1455 Market Street", "street2": "4th Floor"}	1.00	1.00	8.00	4.00	0.00	USD	active	\N	\N	f	\N	\N	{"tracking": {"ship_date": "2025-10-24T00:00:00", "last_event": {"event_code": "OD", "description": "On FedEx vehicle for delivery", "occurred_at": "2025-10-27T14:44:00Z", "postal_code": "94080", "country_code": "US", "city_locality": "SOUTH SAN FRANCISCO", "state_province": "CA", "event_description": "On FedEx vehicle for delivery", "carrier_occurred_at": "2025-10-27T07:44:00"}, "updated_at": "2025-10-27T15:39:27.750Z", "status_code": "IT", "status_description": "In Transit", "carrier_status_code": "OD", "actual_delivery_date": null, "exception_description": null, "estimated_delivery_date": "2025-10-27T00:00:00", "carrier_status_description": "On FedEx vehicle for delivery"}, "reference1": "113015 - CL140326", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 17:35:32.338	2025-10-27 15:39:27.751	2025-10-27 15:39:27.75	in_transit
cmh53vojl00031014h5ndq23j	140022	154160	shipstation	se-160320203	se-74462637	1Z9634840195823891	https://api.shipengine.com/v1/downloads/14/YU6_cLHkY0SMcjl3TP4iUA/label-74462637.pdf	pdf	UPS	UPS Next Day Air®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "90026", "city": "Los Angeles", "name": "Ryder Bennell", "email": "", "phone": "", "state": "CA", "company": "SMYZE", "country": "US", "street1": "1712 Morton Avenue", "street2": ""}	1.00	1.00	\N	\N	19.57	USD	delivered	\N	\N	f	\N	\N	{"tracking": {"ship_date": "2025-10-24T23:09:31Z", "last_event": {"event_code": "D", "description": "Delivered", "occurred_at": "2025-10-27T16:32:55Z", "postal_code": "90026", "country_code": "US", "city_locality": "LOS ANGELES", "state_province": "CA", "event_description": "Delivered", "carrier_occurred_at": "2025-10-27T09:32:55Z"}, "updated_at": "2025-10-27T16:35:44.291Z", "status_code": "DE", "status_description": "Delivered", "carrier_status_code": "D", "actual_delivery_date": "2025-10-27T16:32:55Z", "exception_description": null, "estimated_delivery_date": "2025-10-27T00:00:00Z", "carrier_status_description": "Delivered"}, "reference1": "113033 - CL140022", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 17:09:17.697	2025-10-27 16:35:44.292	2025-10-27 16:35:44.291	delivered
cmh41r9oz000pti60oz3fpsn2	140020	153823	shipstation	se-159924643	se-74271803	394590353418	https://api.shipengine.com/v1/downloads/14/VyFgjASzGkayE7hiiQ1ekA/label-74271803.pdf	pdf	FedEx	FedEx Priority Overnight®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "08822", "city": "Flemington", "name": "", "email": "", "phone": "", "state": "NJ", "company": "AJG Packaging", "country": "US", "street1": "27 Minneakoning Road", "street2": ""}	18.00	18.00	13.00	9.00	139.26	USD	delivered	\N	\N	f	\N	\N	{"tracking": {"ship_date": "2025-10-23T16:23:00-07:00", "last_event": {"event_code": "DL", "description": "Delivered", "occurred_at": "2025-10-24T13:58:00Z", "postal_code": "08822", "country_code": "US", "city_locality": "Flemington", "state_province": "NJ", "event_description": "Delivered", "carrier_occurred_at": "2025-10-24T09:58:00"}, "updated_at": "2025-10-24T15:24:01.861Z", "status_code": "DE", "status_description": "Delivered", "carrier_status_code": "DL", "actual_delivery_date": "2025-10-24T06:58:00-07:00", "exception_description": null, "estimated_delivery_date": null, "carrier_status_description": "Delivered"}, "reference1": "111426 - CL140020", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-23 23:22:06.419	2025-10-24 15:24:01.863	2025-10-24 15:24:01.861	delivered
cmh40scz3000lti60oylfaqgf	140021	153813	shipstation	se-159913530	se-74268396	1Z9634840196608729	https://api.shipengine.com/v1/downloads/14/TVhhlxjRiU2IfKPP4ubAvw/label-74268396.pdf	pdf	UPS	UPS Next Day Air®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "19146", "city": "Philadelphia", "name": "Michael van den Berg", "email": "", "phone": "", "state": "PA", "company": "", "country": "US", "street1": "1936 1/2 Lombard Street", "street2": ""}	1.00	1.00	\N	\N	25.19	USD	delivered	\N	\N	f	\N	\N	{"tracking": {"ship_date": "2025-10-24T01:50:56Z", "last_event": {"event_code": "D", "description": "Delivered", "occurred_at": "2025-10-24T14:11:20Z", "postal_code": "19146", "country_code": "US", "city_locality": "PHILADELPHIA", "state_province": "PA", "event_description": "Delivered", "carrier_occurred_at": "2025-10-24T10:11:20Z"}, "updated_at": "2025-10-24T14:17:01.887Z", "status_code": "DE", "status_description": "Delivered", "carrier_status_code": "D", "actual_delivery_date": "2025-10-24T14:11:20Z", "exception_description": null, "estimated_delivery_date": "2025-10-24T00:00:00Z", "carrier_status_description": "Delivered"}, "reference1": "113224 - CL140021", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-23 22:54:57.711	2025-10-24 14:17:01.889	2025-10-24 14:17:01.887	delivered
cmh54xjnq0005x0zytmmg5in3	140327	154166	shipstation	se-160339512	se-74475871	394615597590	https://api.shipengine.com/v1/downloads/14/AFL0mKdhSkqV0lL-ALjYVQ/label-74475871.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "94523", "city": "Pleasant Hill", "name": "Andrew Macdonald", "email": "mac@uber.com", "phone": "(415) 519-4327", "state": "CA", "company": "2431117-Uber Technologies, Inc.", "country": "US", "street1": "206 Steven Circle", "street2": ""}	1.00	1.00	8.00	4.00	0.00	USD	voided	\N	\N	f	\N	\N	{"reference1": "113015 - CL140327", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 17:38:44.295	2025-10-24 18:33:16.135	\N	\N
cmh54xjvw0007x0zyy6gl157o	140327	154167	shipstation	se-160339512	se-74475871	394615598596	https://api.shipengine.com/v1/downloads/14/AFL0mKdhSkqV0lL-ALjYVQ/label-74475871.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "94523", "city": "Pleasant Hill", "name": "Andrew Macdonald", "email": "mac@uber.com", "phone": "(415) 519-4327", "state": "CA", "company": "2431117-Uber Technologies, Inc.", "country": "US", "street1": "206 Steven Circle", "street2": ""}	1.00	1.00	8.00	4.00	0.00	USD	voided	\N	\N	f	\N	\N	{"reference1": "113015 - CL140327", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 17:38:44.589	2025-10-24 18:33:17.226	\N	\N
cmh40ohf4000hti60tp1orneb	139584	153812	shipstation	se-159912432	se-74267924	1Z9634841399921111	https://api.shipengine.com/v1/downloads/14/Xrtb5Px-T06XOCE5gIxQ2A/label-74267924.pdf	pdf	UPS	UPS Next Day Air Saver®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "10001", "city": "New York", "name": "Katherine Lord", "email": "", "phone": "", "state": "NY", "company": "Rothy's", "country": "US", "street1": "236 5th Ave, 10th Floor", "street2": ""}	19.00	19.00	21.00	12.00	66.96	USD	delivered	\N	\N	f	\N	\N	{"tracking": {"ship_date": "2025-10-24T01:52:53Z", "last_event": {"event_code": "D", "description": "Commercial Inside Release", "occurred_at": "2025-10-24T20:17:27Z", "postal_code": "10001", "country_code": "US", "city_locality": "NEW YORK", "state_province": "NY", "event_description": "Commercial Inside Release", "carrier_occurred_at": "2025-10-24T16:17:27Z"}, "updated_at": "2025-10-24T20:23:30.047Z", "status_code": "DE", "status_description": "Delivered", "carrier_status_code": "D", "actual_delivery_date": "2025-10-24T20:17:27Z", "exception_description": null, "estimated_delivery_date": "2025-10-24T00:00:00Z", "carrier_status_description": "Commercial Inside Release"}, "reference1": "112922 - CL139584", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-23 22:51:56.848	2025-10-24 20:23:30.048	2025-10-24 20:23:30.047	delivered
cmh54xje30003x0zyc761ub2v	140327	154165	shipstation	se-160339512	se-74475871	394615598872	https://api.shipengine.com/v1/downloads/14/AFL0mKdhSkqV0lL-ALjYVQ/label-74475871.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "94523", "city": "Pleasant Hill", "name": "Andrew Macdonald", "email": "mac@uber.com", "phone": "(415) 519-4327", "state": "CA", "company": "2431117-Uber Technologies, Inc.", "country": "US", "street1": "206 Steven Circle", "street2": ""}	1.00	1.00	8.00	4.00	0.00	USD	voided	\N	\N	f	\N	\N	{"reference1": "113015 - CL140327", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 17:38:43.947	2025-10-24 18:33:15.071	\N	\N
cmh54xk440009x0zy4fascot7	140327	154168	shipstation	se-160339512	se-74475871	394615600203	https://api.shipengine.com/v1/downloads/14/AFL0mKdhSkqV0lL-ALjYVQ/label-74475871.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "94523", "city": "Pleasant Hill", "name": "Andrew Macdonald", "email": "mac@uber.com", "phone": "(415) 519-4327", "state": "CA", "company": "2431117-Uber Technologies, Inc.", "country": "US", "street1": "206 Steven Circle", "street2": ""}	1.00	1.00	8.00	4.00	0.00	USD	voided	\N	\N	f	\N	\N	{"reference1": "113015 - CL140327", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 17:38:44.884	2025-10-24 18:33:18.193	\N	\N
cmh54xl1x000hx0zyy2jg1sao	140327	154172	shipstation	se-160339512	se-74475871	394615604172	https://api.shipengine.com/v1/downloads/14/AFL0mKdhSkqV0lL-ALjYVQ/label-74475871.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "94523", "city": "Pleasant Hill", "name": "Andrew Macdonald", "email": "mac@uber.com", "phone": "(415) 519-4327", "state": "CA", "company": "2431117-Uber Technologies, Inc.", "country": "US", "street1": "206 Steven Circle", "street2": ""}	1.00	1.00	8.00	4.00	0.00	USD	voided	\N	\N	f	\N	\N	{"reference1": "113015 - CL140327", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 17:38:46.101	2025-10-24 18:33:21.791	\N	\N
cmh54xlam000jx0zy5j3kofmx	140327	154173	shipstation	se-160339512	se-74475871	394615603783	https://api.shipengine.com/v1/downloads/14/AFL0mKdhSkqV0lL-ALjYVQ/label-74475871.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "94523", "city": "Pleasant Hill", "name": "Andrew Macdonald", "email": "mac@uber.com", "phone": "(415) 519-4327", "state": "CA", "company": "2431117-Uber Technologies, Inc.", "country": "US", "street1": "206 Steven Circle", "street2": ""}	1.00	1.00	8.00	4.00	0.00	USD	voided	\N	\N	f	\N	\N	{"reference1": "113015 - CL140327", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 17:38:46.415	2025-10-24 18:33:22.557	\N	\N
cmh54ygf7000px0zydn86onr6	140327	154177	shipstation	se-160340173	se-74476198	394615641898	https://api.shipengine.com/v1/downloads/14/FjH6lGfJ3UqnUN8Kjx2ZZg/label-74476198.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "94523", "city": "Pleasant Hill", "name": "Andrew Macdonald", "email": "mac@uber.com", "phone": "(415) 519-4327", "state": "CA", "company": "2431117-Uber Technologies, Inc.", "country": "US", "street1": "206 Steven Circle", "street2": ""}	1.00	1.00	8.00	4.00	0.00	USD	voided	\N	\N	f	\N	\N	{"reference1": "113015 - CL140327", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 17:39:26.755	2025-10-24 18:33:25.841	\N	\N
cmh576xro001bx0zybwg81a1u	58927	154483	shipstation	se-160389782	se-74504688	394618925605	https://api.shipengine.com/v1/downloads/14/T4lXFN3iC0KpEWEA4zo2Rw/label-74504688.pdf	pdf	FedEx	FedEx Home Delivery®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "95206", "city": "STOCKTON", "name": "", "email": "", "phone": "(209) 234-3300", "state": "CA", "company": "Cal Sheets", "country": "US", "street1": "1212 PERFORMANCE DRIVE", "street2": ""}	1.00	1.00	12.00	12.00	10.89	USD	voided	\N	\N	f	\N	\N	{"reference1": "1 - CL58927", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 18:42:01.716	2025-10-24 18:44:26.995	\N	\N
cmh57h3g20001xcihplvvtl2g	58927	154484	shipstation	se-160396202	se-74508094	394619335764	https://api.shipengine.com/v1/downloads/14/_KM9wKSr10GMYmN827WsMw/label-74508094.pdf	pdf	FedEx	FedEx Home Delivery®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "95206", "city": "STOCKTON", "name": "", "email": "", "phone": "(209) 234-3300", "state": "CA", "company": "Cal Sheets", "country": "US", "street1": "1212 PERFORMANCE DRIVE", "street2": ""}	1.00	1.00	12.00	12.00	10.89	USD	voided	\N	\N	f	\N	\N	{"reference1": "1 - CL58927", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 18:49:55.634	2025-10-24 18:50:18.588	\N	\N
cmh57lwd800032q4zhe0ijrzn	140012	154486	shipstation	se-160398559	se-74509582	1Z9634840395141721	https://api.shipengine.com/v1/downloads/14/CgiAgJPzxkmrxLxf0l-Rxw/label-74509582.pdf	pdf	UPS	UPS® Ground	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "90020", "city": "Los Angeles", "name": "NICOLE HAN", "email": "nicole.han@lghnhusa.com", "phone": "(909)3482-2692", "state": "CA", "company": "LG H&H USA", "country": "US", "street1": "515 SHATTO PLACE", "street2": ""}	21.00	21.00	14.00	10.00	12.63	USD	active	\N	\N	f	\N	\N	{"reference1": "112778 - CL140012", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 18:53:39.74	2025-10-24 18:53:39.74	\N	\N
cmh598kdc000369wizsh9qomh	139526	154721	shipstation	se-160433245	se-74525961	1Z9634841297744336	https://api.shipengine.com/v1/downloads/14/eFMZJ87-tkCodG4givj17w/label-74525961.pdf	pdf	UPS	UPS 3 Day Select®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "10573", "city": "Port Chester", "name": "", "email": "Jill.Malabanan@bhn.com", "phone": "(714) 234-7350", "state": "NY", "company": "Limor Media", "country": "US", "street1": "14 Willett Avenue", "street2": "Suite 203"}	1.00	1.00	9.00	6.00	15.29	USD	active	\N	\N	f	\N	\N	{"tracking": {"ship_date": "2025-10-24T00:00:00", "last_event": {"event_code": "I", "description": "Arrived at Facility", "occurred_at": "2025-10-25T09:03:00Z", "postal_code": "", "country_code": "US", "city_locality": "Oakland", "state_province": "CA", "event_description": "Arrived at Facility", "carrier_occurred_at": "2025-10-25T02:03:00"}, "updated_at": "2025-10-27T09:19:51.756Z", "status_code": "IT", "status_description": "In Transit", "carrier_status_code": "I", "actual_delivery_date": null, "exception_description": null, "estimated_delivery_date": "2025-10-29T00:00:00", "carrier_status_description": "Arrived at Facility"}, "reference1": "113032 - CL139526", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 19:39:16.896	2025-10-27 09:19:51.757	2025-10-27 09:19:51.756	in_transit
cmh5au6s30007w84gavnh3ejo	140341	154733	shipstation	se-160469207	se-74541165	1Z9634840399261942	https://api.shipengine.com/v1/downloads/14/frnL_dK71Uu9eQPydExp5g/label-74541165.pdf	pdf	UPS	UPS® Ground	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "95014", "city": "Cupertino", "name": "Shantya Martinez Arriaga", "email": "", "phone": "", "state": "CA", "company": "Tessellations School", "country": "US", "street1": "1170 Yorkshire Dr", "street2": ""}	1.00	1.00	\N	\N	10.08	USD	delivered	\N	\N	f	\N	\N	{"tracking": {"ship_date": "2025-10-24T23:09:31Z", "last_event": {"event_code": "D", "description": "Commercial Inside Release", "occurred_at": "2025-10-27T16:59:41Z", "postal_code": "95014", "country_code": "US", "city_locality": "CUPERTINO", "state_province": "CA", "event_description": "Commercial Inside Release", "carrier_occurred_at": "2025-10-27T09:59:41Z"}, "updated_at": "2025-10-27T17:01:56.234Z", "status_code": "DE", "status_description": "Delivered", "carrier_status_code": "D", "actual_delivery_date": "2025-10-27T16:59:41Z", "exception_description": null, "estimated_delivery_date": "2025-10-27T00:00:00Z", "carrier_status_description": "Commercial Inside Release"}, "reference1": "113216 - CL140341", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 20:24:05.331	2025-10-27 17:01:56.235	2025-10-27 17:01:56.234	delivered
cmh5ayv2d000bw84ghbq8elhk	140588	154734	shipstation	se-160471457	se-74542248	1Z9634840390451333	https://api.shipengine.com/v1/downloads/14/2QNCslpoCU2mPIZ6_CYz_g/label-74542248.pdf	pdf	UPS	UPS® Ground	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "98335", "city": "Gig Harbor", "name": "Mary Daniels", "email": "", "phone": "0000000000", "state": "WA", "company": "Mary Daniels", "country": "US", "street1": "4311 33rd Ave. Ct Northwest", "street2": ""}	5.00	5.00	8.00	6.00	13.16	USD	voided	\N	\N	f	\N	\N	{"tracking": {"ship_date": null, "last_event": {"event_code": "M", "description": "Shipper created a label, UPS has not received the package yet.", "occurred_at": "2025-10-24T20:27:42Z", "postal_code": "", "country_code": "US", "city_locality": "", "state_province": "", "event_description": "Shipper created a label, UPS has not received the package yet.", "carrier_occurred_at": "2025-10-24T13:27:42"}, "updated_at": "2025-10-24T20:29:00.753Z", "status_code": "AC", "status_description": "Accepted", "carrier_status_code": "M", "actual_delivery_date": null, "exception_description": null, "estimated_delivery_date": "2025-10-28T00:00:00", "carrier_status_description": "Shipper created a label, UPS has not received the package yet."}, "reference1": "113033 - CL140588", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 20:27:43.43	2025-10-24 20:33:20.224	2025-10-24 20:29:00.753	accepted
cmh5bplto0001uz37dhkx4n4s	140588	\N	shipstation	se-160485326	se-74547522	1Z9634849090491350	https://api.shipengine.com/v1/downloads/14/ImmpRXGGwkWGimMkrUMnRg/label-74547522.pdf	\N	UPS	UPS® Ground	{"zip": "98335", "city": "Gig Harbor", "name": "Mary Daniels", "email": "", "phone": "0000000000", "state": "WA", "company": "Mary Daniels", "country": "US", "street1": "4311 33rd Ave. Ct Northwest", "street2": ""}	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	\N	\N	\N	\N	11.25	usd	voided	\N	\N	t	se-74547516	\N	{"tracking": {"ship_date": null, "last_event": {"event_code": "M", "description": "Shipper created a label, UPS has not received the package yet.", "occurred_at": "2025-10-24T20:48:30Z", "postal_code": "", "country_code": "US", "city_locality": "", "state_province": "", "event_description": "Shipper created a label, UPS has not received the package yet.", "carrier_occurred_at": "2025-10-24T13:48:30"}, "updated_at": "2025-10-24T20:49:47.391Z", "status_code": "AC", "status_description": "Accepted", "carrier_status_code": "M", "actual_delivery_date": null, "exception_description": null, "estimated_delivery_date": null, "carrier_status_description": "Shipper created a label, UPS has not received the package yet."}}	cmgzzea5200001vtaazq29pyk	2025-10-24 20:48:31.164	2025-10-24 20:49:47.392	2025-10-24 20:49:47.391	accepted
cmh57v7oe00072q4zcxvxt2ac	140336	154487	shipstation	se-160403930	se-74512308	394619915655	https://api.shipengine.com/v1/downloads/14/PeyqhXmZCk2IcUjqTg9A5Q/label-74512308.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "94103", "city": "San Francisco", "name": "Hana Ishijima", "email": "", "phone": "(415) 915-1726", "state": "CA", "company": "SFMOMA", "country": "US", "street1": "151 Third Street", "street2": ""}	4.00	4.00	32.00	1.00	0.00	USD	active	\N	\N	f	\N	\N	{"tracking": {"ship_date": "2025-10-24T00:00:00", "last_event": {"event_code": "OD", "description": "On FedEx vehicle for delivery", "occurred_at": "2025-10-27T12:18:00Z", "postal_code": "94080", "country_code": "US", "city_locality": "SOUTH SAN FRANCISCO", "state_province": "CA", "event_description": "On FedEx vehicle for delivery", "carrier_occurred_at": "2025-10-27T05:18:00"}, "updated_at": "2025-10-27T13:04:53.985Z", "status_code": "IT", "status_description": "In Transit", "carrier_status_code": "OD", "actual_delivery_date": null, "exception_description": null, "estimated_delivery_date": "2025-10-27T00:00:00", "carrier_status_description": "On FedEx vehicle for delivery"}, "reference1": "113205 - CL140336", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 19:00:54.303	2025-10-27 13:04:53.986	2025-10-27 13:04:53.985	in_transit
cmh5bpm6z0003uz37yl12dnij	140588	154735	shipstation	se-160485306	se-74547516	1Z9634840392065346	https://api.shipengine.com/v1/downloads/14/NRuE6-FJoE6WUYoXtSqaEw/label-74547516.pdf	pdf	UPS	UPS® Ground	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "98335", "city": "Gig Harbor", "name": "Mary Daniels", "email": "", "phone": "0000000000", "state": "WA", "company": "Mary Daniels", "country": "US", "street1": "4311 33rd Ave. Ct Northwest", "street2": ""}	5.00	5.00	8.00	6.00	13.16	USD	voided	\N	\N	f	\N	\N	{"tracking": {"ship_date": null, "last_event": {"event_code": "M", "description": "Shipper created a label, UPS has not received the package yet.", "occurred_at": "2025-10-24T20:48:27Z", "postal_code": "", "country_code": "US", "city_locality": "", "state_province": "", "event_description": "Shipper created a label, UPS has not received the package yet.", "carrier_occurred_at": "2025-10-24T13:48:27"}, "updated_at": "2025-10-24T20:49:52.007Z", "status_code": "AC", "status_description": "Accepted", "carrier_status_code": "M", "actual_delivery_date": null, "exception_description": null, "estimated_delivery_date": "2025-10-28T00:00:00", "carrier_status_description": "Shipper created a label, UPS has not received the package yet."}, "reference1": "113033 - CL140588", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 20:48:31.644	2025-10-24 20:58:29.439	2025-10-24 20:49:52.007	accepted
cmh5c4pi60005v8ioapyhhbns	140588	154738	shipstation	se-160493618	se-74551505	1Z9634840390129361	https://api.shipengine.com/v1/downloads/14/9SGbuhanI0Ko5r4Nx3_cpg/label-74551505.pdf	pdf	UPS	UPS® Ground	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "98335", "city": "Gig Harbor", "name": "Mary Daniels", "email": "", "phone": "0000000000", "state": "WA", "company": "Mary Daniels", "country": "US", "street1": "4311 33rd Ave. Ct Northwest", "street2": ""}	5.00	5.00	8.00	6.00	13.16	USD	active	\N	\N	f	\N	\N	{"tracking": {"ship_date": "2025-10-24T00:00:00", "last_event": {"event_code": "I", "description": "Departed from Facility", "occurred_at": "2025-10-25T09:54:00Z", "postal_code": "", "country_code": "US", "city_locality": "West Sacramento", "state_province": "CA", "event_description": "Departed from Facility", "carrier_occurred_at": "2025-10-25T02:54:00"}, "updated_at": "2025-10-27T10:10:01.995Z", "status_code": "IT", "status_description": "In Transit", "carrier_status_code": "I", "actual_delivery_date": null, "exception_description": null, "estimated_delivery_date": "2025-10-28T00:00:00", "carrier_status_description": "Departed from Facility"}, "reference1": "113033 - CL140588", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 21:00:15.774	2025-10-27 10:10:01.996	2025-10-27 10:10:01.995	in_transit
cmh5fzkel000vv8ios3jw2njd	140025	154743	shipstation	se-160562487	se-74570548	1Z9634841390641387	https://api.shipengine.com/v1/downloads/14/Uf75h9Z_9EuPb_UUDK7fSA/label-74570548.pdf	pdf	UPS	UPS Next Day Air Saver®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "20706", "city": "Lanham", "name": "Jason Wilburn", "email": "", "phone": "", "state": "MD", "company": "Art Negative", "country": "US", "street1": "4621 – C Boston Way, Suite C", "street2": ""}	29.00	29.00	8.00	12.00	75.40	USD	active	\N	\N	f	\N	\N	{"reference1": "113160 - CL140025", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 22:48:14.349	2025-10-24 22:48:14.349	\N	\N
cmh5fzkne000xv8ior5mibcep	140025	154744	shipstation	se-160562487	se-74570548	1Z9634841390315391	https://api.shipengine.com/v1/downloads/14/Uf75h9Z_9EuPb_UUDK7fSA/label-74570548.pdf	pdf	UPS	UPS Next Day Air Saver®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "20706", "city": "Lanham", "name": "Jason Wilburn", "email": "", "phone": "", "state": "MD", "company": "Art Negative", "country": "US", "street1": "4621 – C Boston Way, Suite C", "street2": ""}	29.00	29.00	8.00	12.00	75.40	USD	active	\N	\N	f	\N	\N	{"reference1": "113160 - CL140025", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 22:48:14.667	2025-10-24 22:48:14.667	\N	\N
cmh5fzk46000tv8iowtomqre2	140025	154742	shipstation	se-160562487	se-74570548	1Z9634841390379377	https://api.shipengine.com/v1/downloads/14/Uf75h9Z_9EuPb_UUDK7fSA/label-74570548.pdf	pdf	UPS	UPS Next Day Air Saver®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "20706", "city": "Lanham", "name": "Jason Wilburn", "email": "", "phone": "", "state": "MD", "company": "Art Negative", "country": "US", "street1": "4621 – C Boston Way, Suite C", "street2": ""}	29.00	29.00	8.00	12.00	75.40	USD	active	\N	\N	f	\N	\N	{"tracking": {"ship_date": "2025-10-24T23:09:31Z", "last_event": {"event_code": "I", "description": "Out for Delivery", "occurred_at": "2025-10-27T13:49:13Z", "postal_code": "", "country_code": "US", "city_locality": "Landover", "state_province": "MD", "event_description": "Out for Delivery", "carrier_occurred_at": "2025-10-27T09:49:13Z"}, "updated_at": "2025-10-27T13:49:54.722Z", "status_code": "IT", "status_description": "In Transit", "carrier_status_code": "I", "actual_delivery_date": null, "exception_description": null, "estimated_delivery_date": "2025-10-27T00:00:00Z", "carrier_status_description": "Out for Delivery"}, "reference1": "113160 - CL140025", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 22:48:13.974	2025-10-27 13:49:54.724	2025-10-27 13:49:54.723	in_transit
cmh56xrr70019x0zy1nmdlvyu	140327	154482	shipstation	se-160383286	se-74501128	394618549071	https://api.shipengine.com/v1/downloads/14/5W7iBfUZOUqakjDe3E0C0g/label-74501128.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "94523", "city": "Pleasant Hill", "name": "Andrew Macdonald", "email": "mac@uber.com", "phone": "(415) 519-4327", "state": "CA", "company": "2431117-Uber Technologies, Inc.", "country": "US", "street1": "206 Steven Circle", "street2": ""}	1.00	1.00	8.00	4.00	0.00	USD	delivered	\N	\N	f	\N	\N	{"tracking": {"ship_date": "2025-10-24T00:00:00", "last_event": {"event_code": "DL", "description": "Delivered", "occurred_at": "2025-10-25T22:17:05Z", "postal_code": "94523", "country_code": "US", "city_locality": "Pleasant Hill", "state_province": "CA", "event_description": "Delivered", "carrier_occurred_at": "2025-10-25T15:17:05"}, "updated_at": "2025-10-25T22:37:57.053Z", "status_code": "DE", "status_description": "Delivered", "carrier_status_code": "DL", "actual_delivery_date": "2025-10-25T15:17:05-07:00", "exception_description": null, "estimated_delivery_date": null, "carrier_status_description": "Delivered"}, "reference1": "113015 - CL140327", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 18:34:54.019	2025-10-25 22:37:57.053	2025-10-25 22:37:57.053	delivered
cmh5g8jen0011v8io797ciecu	140340	154745	shipstation	se-160566404	se-74571295	1Z9634841393801403	https://api.shipengine.com/v1/downloads/14/yXeFy0GNOUuNf8M-2JEQxg/label-74571295.pdf	pdf	UPS	UPS Next Day Air Saver®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "10018", "city": "New York", "name": "Valeriya Volkov", "email": "", "phone": "", "state": "NY", "company": "", "country": "US", "street1": "80 W 40th st", "street2": "2nd fl"}	1.00	1.00	\N	\N	22.48	USD	delivered	\N	\N	f	\N	\N	{"tracking": {"ship_date": "2025-10-24T23:09:31Z", "last_event": {"event_code": "D", "description": "Commercial Inside Release", "occurred_at": "2025-10-27T14:37:06Z", "postal_code": "10018", "country_code": "US", "city_locality": "NEW YORK", "state_province": "NY", "event_description": "Commercial Inside Release", "carrier_occurred_at": "2025-10-27T10:37:06Z"}, "updated_at": "2025-10-27T14:43:54.728Z", "status_code": "DE", "status_description": "Delivered", "carrier_status_code": "D", "actual_delivery_date": "2025-10-27T14:37:06Z", "exception_description": null, "estimated_delivery_date": "2025-10-27T00:00:00Z", "carrier_status_description": "Commercial Inside Release"}, "reference1": "113225 - CL140340", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-24 22:55:12.959	2025-10-27 14:43:54.729	2025-10-27 14:43:54.728	delivered
\.


--
-- Data for Name: Tenant; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."Tenant" (id, name, slug, plan, status, metadata, "createdAt", "updatedAt") FROM stdin;
cmgzzea5200001vtaazq29pyk	Calitho	calitho	enterprise	active	null	2025-10-21 03:04:56.534	2025-10-21 03:04:56.534
cmh00abda000010q001zanzlt	Demo Company	demo	pro	active	null	2025-10-21 03:29:51.118	2025-10-21 03:29:51.118
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."User" (id, email, "emailVerified", name, image, password, "passwordResetRequired", "createdAt", "updatedAt") FROM stdin;
cmh00absf000110q0p1ip6na3	demo@example.com	\N	Demo User	\N	$2a$10$UuogOt1o12q01Dk78Nb3vebz8DCj2GwSupIu4zo.1pptg0tgNvRf2	f	2025-10-21 03:29:51.663	2025-10-21 03:29:51.663
cmh00acib000410q0b27znmfv	admin@example.com	\N	Admin User	\N	$2a$10$QewB.3d13BEg4eeFmnogE.zBKGs3uKIPUGEFrwaCsQD0hry5FNW9K	f	2025-10-21 03:29:52.596	2025-10-21 03:29:52.596
cmh00acz8000710q0yhokvosp	testuser@example.com	\N	Test User	\N	$2a$10$fMJYEPZZ3VDSLqQxDWZmmONvfs4YpLbCO.ZU9b9TKcXlYJTijt07O	t	2025-10-21 03:29:53.204	2025-10-21 03:29:53.204
cmgzzeaa500011vtanifj1f2k	hector.franco@calitho.com	2025-10-21 03:04:56.715	Hector Franco	\N	$2a$10$taSId4Rn1.0zfxLnJpXK2.UgNMgqV7cNiDpB1hWLNEPNiwSk8e49W	f	2025-10-21 03:04:56.717	2025-10-22 02:13:42.751
cmh1jimiw0000c5r673dqamec	yemmy.chamulo@calitho.com	\N	Yemmy Chamulo-Perez	\N	$2a$10$t3DK2XN5i.h/vqokp5YSluftn0b1SZl7ZzXtec.qVheDjO2DJaLlm	f	2025-10-22 05:15:57.704	2025-10-22 05:15:57.704
cmh1jkqfh000ac5r60bkksx2u	dhara@calitho.com	\N	Dhara Taheripour 	\N	$2a$10$11FoUa09NHus4tdR5Ht.w.oGZPrOqPFuD7cwQ9Zj0OXdJlauRmu8u	f	2025-10-22 05:17:36.077	2025-10-22 05:17:36.077
cmh1jlf1d000fc5r6i4lkjlgk	eric.matthews@calitho.com	\N	Eric Matthews	\N	$2a$10$60rgalxKhs2pitDSjDpWWeSUfFJJUkejyAZFK9LX1SzMl9LUgtY8y	f	2025-10-22 05:18:07.969	2025-10-22 05:18:07.969
cmh1jjpif0005c5r6jgsufdqx	amalia.alarcon@calitho.com	\N	Amalia Erlin Alarcon	\N	$2a$10$Pg8oi5TEc8lbUj49W4x.G.ZJWqh0IEwJGl2zFdJs/wh/UO3F6Wrz.	f	2025-10-22 05:16:48.231	2025-10-22 05:22:55.51
cmh55e2jc000sx0zy1r291pqe	stephanie.becerra@calitho.com	\N	Stephanie Becerra	\N	$2a$10$1zqWON2QIy4j2HxkjZNY3uOjTYRtxgIC7KrvDGt.I1Na20KVMuj/.	f	2025-10-24 17:51:35.257	2025-10-24 17:51:35.257
cmh55fnpw000xx0zyd5j4jdjf	shipping@calitho.com	\N	Shipping	\N	$2a$10$Oa5k2meXPbNr8bfLJPTRYelVd6/LqOGXK0ipkWhpQPZRRffP1QVy.	f	2025-10-24 17:52:49.364	2025-10-24 17:52:49.364
cmh5bfaf4000014mfcss58x4x	rob.reuben@calitho.com	\N	Rob Reuben	\N	$2a$10$gcxb5uZoflFb/Gl.blnBhOmxbxS6hjGah.Z0X/r6/nzzgTlVcXsUi	f	2025-10-24 20:40:29.825	2025-10-24 20:40:29.825
\.


--
-- Data for Name: VerificationToken; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."VerificationToken" (identifier, token, expires) FROM stdin;
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
66d01bcd-9048-4484-a1a6-6fb3dd9fef96	790136fd2e3f5bba0149855f8a19a29f91163b87d6b994b2198ad88d32f03bfd	2025-10-22 02:41:00.782782+00	20241016000000_init		\N	2025-10-22 02:41:00.782782+00	0
8bc6553a-337d-48ca-8742-4ed96070241b	d4f295ab8cbaa1895b913d84bd31210f7b2514bfbc868e20a980907e2b4af98e	2025-10-22 02:49:23.222239+00	20251020194200_complete_schema	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20251020194200_complete_schema\n\nDatabase error code: 42P07\n\nDatabase error:\nERROR: relation "Tenant" already exists\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42P07), message: "relation \\"Tenant\\" already exists", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("heap.c"), line: Some(1160), routine: Some("heap_create_with_catalog") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="20251020194200_complete_schema"\n             at schema-engine/connectors/sql-schema-connector/src/apply_migration.rs:106\n   1: schema_core::commands::apply_migrations::Applying migration\n           with migration_name="20251020194200_complete_schema"\n             at schema-engine/core/src/commands/apply_migrations.rs:91\n   2: schema_core::state::ApplyMigrations\n             at schema-engine/core/src/state.rs:226	\N	2025-10-22 02:45:16.264313+00	1
4d73df7f-e0c1-44e4-99b6-ad0f41799741	d4f295ab8cbaa1895b913d84bd31210f7b2514bfbc868e20a980907e2b4af98e	2025-10-22 02:49:23.222239+00	20251020194200_complete_schema	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20251020194200_complete_schema\n\nDatabase error code: 42P07\n\nDatabase error:\nERROR: relation "Tenant" already exists\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42P07), message: "relation \\"Tenant\\" already exists", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("heap.c"), line: Some(1160), routine: Some("heap_create_with_catalog") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="20251020194200_complete_schema"\n             at schema-engine/connectors/sql-schema-connector/src/apply_migration.rs:106\n   1: schema_core::commands::apply_migrations::Applying migration\n           with migration_name="20251020194200_complete_schema"\n             at schema-engine/core/src/commands/apply_migrations.rs:91\n   2: schema_core::state::ApplyMigrations\n             at schema-engine/core/src/state.rs:226	\N	2025-10-22 02:47:05.34913+00	1
dcb10424-31a0-42fa-9712-e96578538d77	d4f295ab8cbaa1895b913d84bd31210f7b2514bfbc868e20a980907e2b4af98e	2025-10-22 02:49:23.222239+00	20251020194200_complete_schema	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20251020194200_complete_schema\n\nDatabase error code: 42P07\n\nDatabase error:\nERROR: relation "Tenant" already exists\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42P07), message: "relation \\"Tenant\\" already exists", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("heap.c"), line: Some(1160), routine: Some("heap_create_with_catalog") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="20251020194200_complete_schema"\n             at schema-engine/connectors/sql-schema-connector/src/apply_migration.rs:106\n   1: schema_core::commands::apply_migrations::Applying migration\n           with migration_name="20251020194200_complete_schema"\n             at schema-engine/core/src/commands/apply_migrations.rs:91\n   2: schema_core::state::ApplyMigrations\n             at schema-engine/core/src/state.rs:226	\N	2025-10-22 02:47:39.242313+00	1
9d3da020-ed9d-4c26-b8ad-d962ac13cd37	19b9264082624071291ecfc8ebd9e4c7a794498e6d758cca27e73f39025203ab	2025-10-22 02:49:23.48693+00	20251020194500_add_batch_import	\N	\N	2025-10-22 02:49:23.48693+00	1
6a844e71-3c7f-43c1-8161-efc7e28e7bbb	47e61b889870a0d3e0da70a1b2ab1beadd7313d4cc16836de6cbd29e57b11611	2025-10-22 02:49:23.657986+00	20251021170100_add_carrier_service_mapping	\N	\N	2025-10-22 02:49:23.657986+00	1
d5eab92e-a4a9-4621-a9d3-5b7052cb8ccb	2b01993f8853db81ecb38d5216e2af85a877be6333e431954737da66c06fa5cf	2025-10-22 02:49:23.820071+00	20251021184400_add_retry_tracking	\N	\N	2025-10-22 02:49:23.820071+00	1
6b515c1a-5021-44d1-ab9b-3144723a78b2	c5c546d487d8f7415b25840fda660a5a76c1dc44a617535aa71dc67bc24324b4	2025-10-22 02:49:23.981129+00	20251021200000_add_notes_field	\N	\N	2025-10-22 02:49:23.981129+00	1
ece9fd8e-897e-4cca-a626-4e84ce193f66	6526ced4daea3c6f115363e66078c89c4120e4cb37d2a301b3bb64b7a58dcac8	2025-10-22 02:49:24.14151+00	20251021210000_make_pace_shipment_id_optional	\N	\N	2025-10-22 02:49:24.14151+00	1
676c4b83-70b0-4901-9b44-636f740d2936	910881f49c06a4430efaa7286b4f0e5be818283a6e8d58f866042266205df5fe	2025-10-24 02:02:49.012773+00	20251024013541_baseline	\N	\N	2025-10-24 02:02:48.722802+00	1
3b174422-4d9a-4c13-b9dd-94890296ee0a	d4b9070306da79e40c681e6af0e88f03c38d851d3eccef3efa34a83a1fad11db	2025-10-24 02:04:01.601571+00	20251024013734_add_invoice_integrations	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20251024013734_add_invoice_integrations\n\nDatabase error code: 42710\n\nDatabase error:\nERROR: type "BatchImportStatus" already exists\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42710), message: "type \\"BatchImportStatus\\" already exists", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("typecmds.c"), line: Some(1177), routine: Some("DefineEnum") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="20251024013734_add_invoice_integrations"\n             at schema-engine/connectors/sql-schema-connector/src/apply_migration.rs:106\n   1: schema_core::commands::apply_migrations::Applying migration\n           with migration_name="20251024013734_add_invoice_integrations"\n             at schema-engine/core/src/commands/apply_migrations.rs:91\n   2: schema_core::state::ApplyMigrations\n             at schema-engine/core/src/state.rs:226	\N	2025-10-24 02:02:49.121811+00	0
5938455d-16f1-47d3-bfd4-8bc5ea7e8290	bc54a28c7f0fbdf547d70e3c720ec7cf4d58f2a676429c5cd12742ef485ead96	2025-10-24 17:19:23.194571+00	20251024000000_add_tenant_to_invoice_integration	\N	\N	2025-10-24 17:19:22.869238+00	1
\.


--
-- Name: Account Account_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY (id);


--
-- Name: Attachment Attachment_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: BatchImportMapping BatchImportMapping_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."BatchImportMapping"
    ADD CONSTRAINT "BatchImportMapping_pkey" PRIMARY KEY (id);


--
-- Name: BatchImportRow BatchImportRow_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."BatchImportRow"
    ADD CONSTRAINT "BatchImportRow_pkey" PRIMARY KEY (id);


--
-- Name: BatchImport BatchImport_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."BatchImport"
    ADD CONSTRAINT "BatchImport_pkey" PRIMARY KEY (id);


--
-- Name: CarrierServiceMapping CarrierServiceMapping_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."CarrierServiceMapping"
    ADD CONSTRAINT "CarrierServiceMapping_pkey" PRIMARY KEY (id);


--
-- Name: Integration Integration_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Integration"
    ADD CONSTRAINT "Integration_pkey" PRIMARY KEY (id);


--
-- Name: InvoiceIntegration InvoiceIntegration_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."InvoiceIntegration"
    ADD CONSTRAINT "InvoiceIntegration_pkey" PRIMARY KEY (id);


--
-- Name: Job Job_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Job"
    ADD CONSTRAINT "Job_pkey" PRIMARY KEY (id);


--
-- Name: Membership Membership_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Membership"
    ADD CONSTRAINT "Membership_pkey" PRIMARY KEY (id);


--
-- Name: MenuConfiguration MenuConfiguration_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."MenuConfiguration"
    ADD CONSTRAINT "MenuConfiguration_pkey" PRIMARY KEY (id);


--
-- Name: NetSuiteIntegration NetSuiteIntegration_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."NetSuiteIntegration"
    ADD CONSTRAINT "NetSuiteIntegration_pkey" PRIMARY KEY (id);


--
-- Name: OrderItem OrderItem_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_pkey" PRIMARY KEY (id);


--
-- Name: Order Order_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: ShipmentTypeMapping ShipmentTypeMapping_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."ShipmentTypeMapping"
    ADD CONSTRAINT "ShipmentTypeMapping_pkey" PRIMARY KEY (id);


--
-- Name: ShippingLabel ShippingLabel_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."ShippingLabel"
    ADD CONSTRAINT "ShippingLabel_pkey" PRIMARY KEY (id);


--
-- Name: Tenant Tenant_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Tenant"
    ADD CONSTRAINT "Tenant_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Account_provider_providerAccountId_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON public."Account" USING btree (provider, "providerAccountId");


--
-- Name: Account_userId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Account_userId_idx" ON public."Account" USING btree ("userId");


--
-- Name: Attachment_key_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Attachment_key_idx" ON public."Attachment" USING btree (key);


--
-- Name: Attachment_orderId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Attachment_orderId_idx" ON public."Attachment" USING btree ("orderId");


--
-- Name: Attachment_tenantId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Attachment_tenantId_idx" ON public."Attachment" USING btree ("tenantId");


--
-- Name: AuditLog_action_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "AuditLog_action_idx" ON public."AuditLog" USING btree (action);


--
-- Name: AuditLog_createdAt_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "AuditLog_createdAt_idx" ON public."AuditLog" USING btree ("createdAt");


--
-- Name: AuditLog_entityType_entityId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "AuditLog_entityType_entityId_idx" ON public."AuditLog" USING btree ("entityType", "entityId");


--
-- Name: AuditLog_tenantId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "AuditLog_tenantId_idx" ON public."AuditLog" USING btree ("tenantId");


--
-- Name: AuditLog_userId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "AuditLog_userId_idx" ON public."AuditLog" USING btree ("userId");


--
-- Name: BatchImportMapping_tenantId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "BatchImportMapping_tenantId_idx" ON public."BatchImportMapping" USING btree ("tenantId");


--
-- Name: BatchImportMapping_userId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "BatchImportMapping_userId_idx" ON public."BatchImportMapping" USING btree ("userId");


--
-- Name: BatchImportRow_batchImportId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "BatchImportRow_batchImportId_idx" ON public."BatchImportRow" USING btree ("batchImportId");


--
-- Name: BatchImportRow_batchImportId_status_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "BatchImportRow_batchImportId_status_idx" ON public."BatchImportRow" USING btree ("batchImportId", status);


--
-- Name: BatchImportRow_groupKey_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "BatchImportRow_groupKey_idx" ON public."BatchImportRow" USING btree ("groupKey");


--
-- Name: BatchImportRow_jobNumber_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "BatchImportRow_jobNumber_idx" ON public."BatchImportRow" USING btree ("jobNumber");


--
-- Name: BatchImportRow_status_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "BatchImportRow_status_idx" ON public."BatchImportRow" USING btree (status);


--
-- Name: BatchImport_createdAt_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "BatchImport_createdAt_idx" ON public."BatchImport" USING btree ("createdAt");


--
-- Name: BatchImport_status_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "BatchImport_status_idx" ON public."BatchImport" USING btree (status);


--
-- Name: BatchImport_tenantId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "BatchImport_tenantId_idx" ON public."BatchImport" USING btree ("tenantId");


--
-- Name: CarrierServiceMapping_shipstationCarrierCode_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "CarrierServiceMapping_shipstationCarrierCode_idx" ON public."CarrierServiceMapping" USING btree ("shipstationCarrierCode");


--
-- Name: CarrierServiceMapping_shipstationServiceCode_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "CarrierServiceMapping_shipstationServiceCode_idx" ON public."CarrierServiceMapping" USING btree ("shipstationServiceCode");


--
-- Name: CarrierServiceMapping_tenantId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "CarrierServiceMapping_tenantId_idx" ON public."CarrierServiceMapping" USING btree ("tenantId");


--
-- Name: CarrierServiceMapping_tenantId_shipstationCarrierId_shipsta_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "CarrierServiceMapping_tenantId_shipstationCarrierId_shipsta_key" ON public."CarrierServiceMapping" USING btree ("tenantId", "shipstationCarrierId", "shipstationServiceCode");


--
-- Name: Integration_enabled_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Integration_enabled_idx" ON public."Integration" USING btree (enabled);


--
-- Name: Integration_provider_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Integration_provider_idx" ON public."Integration" USING btree (provider);


--
-- Name: Integration_tenantId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Integration_tenantId_idx" ON public."Integration" USING btree ("tenantId");


--
-- Name: Integration_tenantId_provider_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "Integration_tenantId_provider_key" ON public."Integration" USING btree ("tenantId", provider);


--
-- Name: InvoiceIntegration_createdAt_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "InvoiceIntegration_createdAt_idx" ON public."InvoiceIntegration" USING btree ("createdAt");


--
-- Name: InvoiceIntegration_invoiceNumber_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "InvoiceIntegration_invoiceNumber_idx" ON public."InvoiceIntegration" USING btree ("invoiceNumber");


--
-- Name: InvoiceIntegration_invoiceNumber_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "InvoiceIntegration_invoiceNumber_key" ON public."InvoiceIntegration" USING btree ("invoiceNumber");


--
-- Name: InvoiceIntegration_status_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "InvoiceIntegration_status_idx" ON public."InvoiceIntegration" USING btree (status);


--
-- Name: InvoiceIntegration_status_retryCount_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "InvoiceIntegration_status_retryCount_idx" ON public."InvoiceIntegration" USING btree (status, "retryCount");


--
-- Name: InvoiceIntegration_tenantId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "InvoiceIntegration_tenantId_idx" ON public."InvoiceIntegration" USING btree ("tenantId");


--
-- Name: Job_createdAt_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Job_createdAt_idx" ON public."Job" USING btree ("createdAt");


--
-- Name: Job_status_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Job_status_idx" ON public."Job" USING btree (status);


--
-- Name: Job_type_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Job_type_idx" ON public."Job" USING btree (type);


--
-- Name: Membership_tenantId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Membership_tenantId_idx" ON public."Membership" USING btree ("tenantId");


--
-- Name: Membership_userId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Membership_userId_idx" ON public."Membership" USING btree ("userId");


--
-- Name: Membership_userId_tenantId_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "Membership_userId_tenantId_key" ON public."Membership" USING btree ("userId", "tenantId");


--
-- Name: MenuConfiguration_order_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "MenuConfiguration_order_idx" ON public."MenuConfiguration" USING btree ("order");


--
-- Name: MenuConfiguration_tenantId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "MenuConfiguration_tenantId_idx" ON public."MenuConfiguration" USING btree ("tenantId");


--
-- Name: MenuConfiguration_tenantId_isActive_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "MenuConfiguration_tenantId_isActive_idx" ON public."MenuConfiguration" USING btree ("tenantId", "isActive");


--
-- Name: MenuConfiguration_tenantId_menuKey_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "MenuConfiguration_tenantId_menuKey_key" ON public."MenuConfiguration" USING btree ("tenantId", "menuKey");


--
-- Name: NetSuiteIntegration_currentMode_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "NetSuiteIntegration_currentMode_idx" ON public."NetSuiteIntegration" USING btree ("currentMode");


--
-- Name: NetSuiteIntegration_tenantId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "NetSuiteIntegration_tenantId_idx" ON public."NetSuiteIntegration" USING btree ("tenantId");


--
-- Name: NetSuiteIntegration_tenantId_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "NetSuiteIntegration_tenantId_key" ON public."NetSuiteIntegration" USING btree ("tenantId");


--
-- Name: OrderItem_orderId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "OrderItem_orderId_idx" ON public."OrderItem" USING btree ("orderId");


--
-- Name: Order_createdAt_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Order_createdAt_idx" ON public."Order" USING btree ("createdAt");


--
-- Name: Order_customerEmail_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Order_customerEmail_idx" ON public."Order" USING btree ("customerEmail");


--
-- Name: Order_orderNumber_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Order_orderNumber_idx" ON public."Order" USING btree ("orderNumber");


--
-- Name: Order_orderNumber_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "Order_orderNumber_key" ON public."Order" USING btree ("orderNumber");


--
-- Name: Order_status_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Order_status_idx" ON public."Order" USING btree (status);


--
-- Name: Order_tenantId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Order_tenantId_idx" ON public."Order" USING btree ("tenantId");


--
-- Name: Session_sessionToken_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "Session_sessionToken_key" ON public."Session" USING btree ("sessionToken");


--
-- Name: Session_userId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Session_userId_idx" ON public."Session" USING btree ("userId");


--
-- Name: ShipmentTypeMapping_tenantId_completedTypeId_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "ShipmentTypeMapping_tenantId_completedTypeId_key" ON public."ShipmentTypeMapping" USING btree ("tenantId", "completedTypeId");


--
-- Name: ShipmentTypeMapping_tenantId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "ShipmentTypeMapping_tenantId_idx" ON public."ShipmentTypeMapping" USING btree ("tenantId");


--
-- Name: ShipmentTypeMapping_tenantId_plannedTypeId_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "ShipmentTypeMapping_tenantId_plannedTypeId_key" ON public."ShipmentTypeMapping" USING btree ("tenantId", "plannedTypeId");


--
-- Name: ShippingLabel_createdAt_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "ShippingLabel_createdAt_idx" ON public."ShippingLabel" USING btree ("createdAt");


--
-- Name: ShippingLabel_isReturnLabel_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "ShippingLabel_isReturnLabel_idx" ON public."ShippingLabel" USING btree ("isReturnLabel");


--
-- Name: ShippingLabel_paceCartonId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "ShippingLabel_paceCartonId_idx" ON public."ShippingLabel" USING btree ("paceCartonId");


--
-- Name: ShippingLabel_paceShipmentId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "ShippingLabel_paceShipmentId_idx" ON public."ShippingLabel" USING btree ("paceShipmentId");


--
-- Name: ShippingLabel_provider_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "ShippingLabel_provider_idx" ON public."ShippingLabel" USING btree (provider);


--
-- Name: ShippingLabel_status_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "ShippingLabel_status_idx" ON public."ShippingLabel" USING btree (status);


--
-- Name: ShippingLabel_tenantId_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "ShippingLabel_tenantId_idx" ON public."ShippingLabel" USING btree ("tenantId");


--
-- Name: ShippingLabel_trackingNumber_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "ShippingLabel_trackingNumber_idx" ON public."ShippingLabel" USING btree ("trackingNumber");


--
-- Name: ShippingLabel_trackingStatus_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "ShippingLabel_trackingStatus_idx" ON public."ShippingLabel" USING btree ("trackingStatus");


--
-- Name: Tenant_slug_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Tenant_slug_idx" ON public."Tenant" USING btree (slug);


--
-- Name: Tenant_slug_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "Tenant_slug_key" ON public."Tenant" USING btree (slug);


--
-- Name: Tenant_status_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "Tenant_status_idx" ON public."Tenant" USING btree (status);


--
-- Name: User_email_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "User_email_idx" ON public."User" USING btree (email);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: VerificationToken_identifier_token_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON public."VerificationToken" USING btree (identifier, token);


--
-- Name: VerificationToken_token_key; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX "VerificationToken_token_key" ON public."VerificationToken" USING btree (token);


--
-- Name: Account Account_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Attachment Attachment_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Attachment Attachment_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AuditLog AuditLog_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AuditLog AuditLog_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AuditLog AuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BatchImportRow BatchImportRow_batchImportId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."BatchImportRow"
    ADD CONSTRAINT "BatchImportRow_batchImportId_fkey" FOREIGN KEY ("batchImportId") REFERENCES public."BatchImport"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BatchImport BatchImport_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."BatchImport"
    ADD CONSTRAINT "BatchImport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CarrierServiceMapping CarrierServiceMapping_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."CarrierServiceMapping"
    ADD CONSTRAINT "CarrierServiceMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Integration Integration_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Integration"
    ADD CONSTRAINT "Integration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InvoiceIntegration InvoiceIntegration_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."InvoiceIntegration"
    ADD CONSTRAINT "InvoiceIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Membership Membership_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Membership"
    ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Membership Membership_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Membership"
    ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MenuConfiguration MenuConfiguration_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."MenuConfiguration"
    ADD CONSTRAINT "MenuConfiguration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: NetSuiteIntegration NetSuiteIntegration_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."NetSuiteIntegration"
    ADD CONSTRAINT "NetSuiteIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderItem OrderItem_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Order Order_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ShipmentTypeMapping ShipmentTypeMapping_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."ShipmentTypeMapping"
    ADD CONSTRAINT "ShipmentTypeMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ShippingLabel ShippingLabel_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."ShippingLabel"
    ADD CONSTRAINT "ShippingLabel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: neondb_owner
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict MXDfuDxe3wx33lkjdE463tsuIcebzOp48KKCWXLO8Xq5PRim4maRfVXF7puBAAB

