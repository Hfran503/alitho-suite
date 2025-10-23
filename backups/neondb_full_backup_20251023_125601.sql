--
-- PostgreSQL database dump
--

\restrict yvyoUtC35s5igXfiC0QF3mHrRzk4PR0n9fwczT7W2RIcfExITqtoqBb445UGrVK

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

ALTER TABLE IF EXISTS ONLY public."ShippingLabel" DROP CONSTRAINT IF EXISTS "ShippingLabel_tenantId_fkey";
ALTER TABLE IF EXISTS ONLY public."ShipmentTypeMapping" DROP CONSTRAINT IF EXISTS "ShipmentTypeMapping_tenantId_fkey";
ALTER TABLE IF EXISTS ONLY public."Session" DROP CONSTRAINT IF EXISTS "Session_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."Order" DROP CONSTRAINT IF EXISTS "Order_tenantId_fkey";
ALTER TABLE IF EXISTS ONLY public."OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_orderId_fkey";
ALTER TABLE IF EXISTS ONLY public."MenuConfiguration" DROP CONSTRAINT IF EXISTS "MenuConfiguration_tenantId_fkey";
ALTER TABLE IF EXISTS ONLY public."Membership" DROP CONSTRAINT IF EXISTS "Membership_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."Membership" DROP CONSTRAINT IF EXISTS "Membership_tenantId_fkey";
ALTER TABLE IF EXISTS ONLY public."Integration" DROP CONSTRAINT IF EXISTS "Integration_tenantId_fkey";
ALTER TABLE IF EXISTS ONLY public."CarrierServiceMapping" DROP CONSTRAINT IF EXISTS "CarrierServiceMapping_tenantId_fkey";
ALTER TABLE IF EXISTS ONLY public."BatchImport" DROP CONSTRAINT IF EXISTS "BatchImport_tenantId_fkey";
ALTER TABLE IF EXISTS ONLY public."BatchImportRow" DROP CONSTRAINT IF EXISTS "BatchImportRow_batchImportId_fkey";
ALTER TABLE IF EXISTS ONLY public."AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_tenantId_fkey";
ALTER TABLE IF EXISTS ONLY public."AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_orderId_fkey";
ALTER TABLE IF EXISTS ONLY public."Attachment" DROP CONSTRAINT IF EXISTS "Attachment_tenantId_fkey";
ALTER TABLE IF EXISTS ONLY public."Attachment" DROP CONSTRAINT IF EXISTS "Attachment_orderId_fkey";
ALTER TABLE IF EXISTS ONLY public."Account" DROP CONSTRAINT IF EXISTS "Account_userId_fkey";
DROP INDEX IF EXISTS public."VerificationToken_token_key";
DROP INDEX IF EXISTS public."VerificationToken_identifier_token_key";
DROP INDEX IF EXISTS public."User_email_key";
DROP INDEX IF EXISTS public."User_email_idx";
DROP INDEX IF EXISTS public."Tenant_status_idx";
DROP INDEX IF EXISTS public."Tenant_slug_key";
DROP INDEX IF EXISTS public."Tenant_slug_idx";
DROP INDEX IF EXISTS public."ShippingLabel_trackingStatus_idx";
DROP INDEX IF EXISTS public."ShippingLabel_trackingNumber_idx";
DROP INDEX IF EXISTS public."ShippingLabel_tenantId_idx";
DROP INDEX IF EXISTS public."ShippingLabel_status_idx";
DROP INDEX IF EXISTS public."ShippingLabel_provider_idx";
DROP INDEX IF EXISTS public."ShippingLabel_paceShipmentId_idx";
DROP INDEX IF EXISTS public."ShippingLabel_paceCartonId_idx";
DROP INDEX IF EXISTS public."ShippingLabel_isReturnLabel_idx";
DROP INDEX IF EXISTS public."ShippingLabel_createdAt_idx";
DROP INDEX IF EXISTS public."ShipmentTypeMapping_tenantId_plannedTypeId_key";
DROP INDEX IF EXISTS public."ShipmentTypeMapping_tenantId_idx";
DROP INDEX IF EXISTS public."ShipmentTypeMapping_tenantId_completedTypeId_key";
DROP INDEX IF EXISTS public."Session_userId_idx";
DROP INDEX IF EXISTS public."Session_sessionToken_key";
DROP INDEX IF EXISTS public."Order_tenantId_idx";
DROP INDEX IF EXISTS public."Order_status_idx";
DROP INDEX IF EXISTS public."Order_orderNumber_key";
DROP INDEX IF EXISTS public."Order_orderNumber_idx";
DROP INDEX IF EXISTS public."Order_customerEmail_idx";
DROP INDEX IF EXISTS public."Order_createdAt_idx";
DROP INDEX IF EXISTS public."OrderItem_orderId_idx";
DROP INDEX IF EXISTS public."MenuConfiguration_tenantId_menuKey_key";
DROP INDEX IF EXISTS public."MenuConfiguration_tenantId_isActive_idx";
DROP INDEX IF EXISTS public."MenuConfiguration_tenantId_idx";
DROP INDEX IF EXISTS public."MenuConfiguration_order_idx";
DROP INDEX IF EXISTS public."Membership_userId_tenantId_key";
DROP INDEX IF EXISTS public."Membership_userId_idx";
DROP INDEX IF EXISTS public."Membership_tenantId_idx";
DROP INDEX IF EXISTS public."Job_type_idx";
DROP INDEX IF EXISTS public."Job_status_idx";
DROP INDEX IF EXISTS public."Job_createdAt_idx";
DROP INDEX IF EXISTS public."Integration_tenantId_provider_key";
DROP INDEX IF EXISTS public."Integration_tenantId_idx";
DROP INDEX IF EXISTS public."Integration_provider_idx";
DROP INDEX IF EXISTS public."Integration_enabled_idx";
DROP INDEX IF EXISTS public."CarrierServiceMapping_tenantId_shipstationCarrierId_shipsta_key";
DROP INDEX IF EXISTS public."CarrierServiceMapping_tenantId_idx";
DROP INDEX IF EXISTS public."CarrierServiceMapping_shipstationServiceCode_idx";
DROP INDEX IF EXISTS public."CarrierServiceMapping_shipstationCarrierCode_idx";
DROP INDEX IF EXISTS public."BatchImport_tenantId_idx";
DROP INDEX IF EXISTS public."BatchImport_status_idx";
DROP INDEX IF EXISTS public."BatchImport_createdAt_idx";
DROP INDEX IF EXISTS public."BatchImportRow_status_idx";
DROP INDEX IF EXISTS public."BatchImportRow_jobNumber_idx";
DROP INDEX IF EXISTS public."BatchImportRow_groupKey_idx";
DROP INDEX IF EXISTS public."BatchImportRow_batchImportId_status_idx";
DROP INDEX IF EXISTS public."BatchImportRow_batchImportId_idx";
DROP INDEX IF EXISTS public."BatchImportMapping_userId_idx";
DROP INDEX IF EXISTS public."BatchImportMapping_tenantId_idx";
DROP INDEX IF EXISTS public."AuditLog_userId_idx";
DROP INDEX IF EXISTS public."AuditLog_tenantId_idx";
DROP INDEX IF EXISTS public."AuditLog_entityType_entityId_idx";
DROP INDEX IF EXISTS public."AuditLog_createdAt_idx";
DROP INDEX IF EXISTS public."AuditLog_action_idx";
DROP INDEX IF EXISTS public."Attachment_tenantId_idx";
DROP INDEX IF EXISTS public."Attachment_orderId_idx";
DROP INDEX IF EXISTS public."Attachment_key_idx";
DROP INDEX IF EXISTS public."Account_userId_idx";
DROP INDEX IF EXISTS public."Account_provider_providerAccountId_key";
ALTER TABLE IF EXISTS ONLY public._prisma_migrations DROP CONSTRAINT IF EXISTS _prisma_migrations_pkey;
ALTER TABLE IF EXISTS ONLY public."User" DROP CONSTRAINT IF EXISTS "User_pkey";
ALTER TABLE IF EXISTS ONLY public."Tenant" DROP CONSTRAINT IF EXISTS "Tenant_pkey";
ALTER TABLE IF EXISTS ONLY public."ShippingLabel" DROP CONSTRAINT IF EXISTS "ShippingLabel_pkey";
ALTER TABLE IF EXISTS ONLY public."ShipmentTypeMapping" DROP CONSTRAINT IF EXISTS "ShipmentTypeMapping_pkey";
ALTER TABLE IF EXISTS ONLY public."Session" DROP CONSTRAINT IF EXISTS "Session_pkey";
ALTER TABLE IF EXISTS ONLY public."Order" DROP CONSTRAINT IF EXISTS "Order_pkey";
ALTER TABLE IF EXISTS ONLY public."OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_pkey";
ALTER TABLE IF EXISTS ONLY public."MenuConfiguration" DROP CONSTRAINT IF EXISTS "MenuConfiguration_pkey";
ALTER TABLE IF EXISTS ONLY public."Membership" DROP CONSTRAINT IF EXISTS "Membership_pkey";
ALTER TABLE IF EXISTS ONLY public."Job" DROP CONSTRAINT IF EXISTS "Job_pkey";
ALTER TABLE IF EXISTS ONLY public."Integration" DROP CONSTRAINT IF EXISTS "Integration_pkey";
ALTER TABLE IF EXISTS ONLY public."CarrierServiceMapping" DROP CONSTRAINT IF EXISTS "CarrierServiceMapping_pkey";
ALTER TABLE IF EXISTS ONLY public."BatchImport" DROP CONSTRAINT IF EXISTS "BatchImport_pkey";
ALTER TABLE IF EXISTS ONLY public."BatchImportRow" DROP CONSTRAINT IF EXISTS "BatchImportRow_pkey";
ALTER TABLE IF EXISTS ONLY public."BatchImportMapping" DROP CONSTRAINT IF EXISTS "BatchImportMapping_pkey";
ALTER TABLE IF EXISTS ONLY public."AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_pkey";
ALTER TABLE IF EXISTS ONLY public."Attachment" DROP CONSTRAINT IF EXISTS "Attachment_pkey";
ALTER TABLE IF EXISTS ONLY public."Account" DROP CONSTRAINT IF EXISTS "Account_pkey";
DROP TABLE IF EXISTS public._prisma_migrations;
DROP TABLE IF EXISTS public."VerificationToken";
DROP TABLE IF EXISTS public."User";
DROP TABLE IF EXISTS public."Tenant";
DROP TABLE IF EXISTS public."ShippingLabel";
DROP TABLE IF EXISTS public."ShipmentTypeMapping";
DROP TABLE IF EXISTS public."Session";
DROP TABLE IF EXISTS public."OrderItem";
DROP TABLE IF EXISTS public."Order";
DROP TABLE IF EXISTS public."MenuConfiguration";
DROP TABLE IF EXISTS public."Membership";
DROP TABLE IF EXISTS public."Job";
DROP TABLE IF EXISTS public."Integration";
DROP TABLE IF EXISTS public."CarrierServiceMapping";
DROP TABLE IF EXISTS public."BatchImportRow";
DROP TABLE IF EXISTS public."BatchImportMapping";
DROP TABLE IF EXISTS public."BatchImport";
DROP TABLE IF EXISTS public."AuditLog";
DROP TABLE IF EXISTS public."Attachment";
DROP TABLE IF EXISTS public."Account";
DROP TYPE IF EXISTS public."BatchRowStatus";
DROP TYPE IF EXISTS public."BatchImportStatus";
-- *not* dropping schema, since initdb creates it
--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: BatchImportStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BatchImportStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'COMPLETE',
    'CANCELLED'
);


--
-- Name: BatchRowStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BatchRowStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'SUCCESS',
    'FAILED',
    'CANCELLED'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Account; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: Attachment; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: BatchImport; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: BatchImportMapping; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: BatchImportRow; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: CarrierServiceMapping; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: Integration; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: Job; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: Membership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Membership" (
    id text NOT NULL,
    role text DEFAULT 'customer_service'::text NOT NULL,
    "userId" text NOT NULL,
    "tenantId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: MenuConfiguration; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: Order; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: OrderItem; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: Session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


--
-- Name: ShipmentTypeMapping; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: ShippingLabel; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: Tenant; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: VerificationToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VerificationToken" (
    identifier text NOT NULL,
    token text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
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


--
-- Data for Name: Account; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Account" (id, "userId", type, provider, "providerAccountId", refresh_token, access_token, expires_at, token_type, scope, id_token, session_state) FROM stdin;
\.


--
-- Data for Name: Attachment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Attachment" (id, filename, "mimeType", size, bucket, key, url, metadata, "tenantId", "orderId", "uploadedBy", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: -
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
\.


--
-- Data for Name: BatchImport; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."BatchImport" (id, "fileName", "fileUrl", "sheetName", status, "totalRows", "processedRows", "successfulRows", "failedRows", "carrierId", "carrierCode", "serviceCode", carrier, service, "billToParty", "billToAccount", "billToCountryCode", "billToPostalCode", "containsAlcohol", "saturdayDelivery", confirmation, "notificationsEmail", "fromAddress", "columnMapping", "tenantId", "createdBy", "createdAt", "updatedAt", "startedAt", "completedAt") FROM stdin;
cmh3rkwsp0001vi7ioccvnnv8	J112197_GROUND_07-10 & 07-11.xlsx	\N	Test	COMPLETE	1	1	0	1	se-3932358	fedex	fedex_ground	FedEx	FedEx Ground®	third_party	204762943	US	10016	f	f	none	\N	"{\\"zip\\":\\"94520\\",\\"city\\":\\"Concord\\",\\"name\\":\\"Shipping Manager\\",\\"phone\\":\\"9256821111\\",\\"state\\":\\"CA\\",\\"company\\":\\"Calitho\\",\\"country\\":\\"US\\",\\"street1\\":\\"2312 Stanwell Dr\\",\\"street2\\":\\"\\"}"	{"width": "DimensionsW", "height": "DimensionsH", "length": "DimensionsL", "weight": "PackageWeight", "shipDate": "ShipDate", "jobNumber": "Job#", "shipToZip": "ShipToZipCode", "itemNumber": "ItemNumber", "reference1": "Reference1", "reference2": "Reference2", "reference3": "Reference3", "shipToCity": "ShipToCity", "shipToName": "ShipToCompany", "shipToPhone": "ShipToPhoneNo", "shipToState": "ShipToState", "itemQuantity": "ItemQuantity", "packageNumber": "PackageNumber", "shipToCompany": "ShipToName", "shipToCountry": "ShipToCountry", "totalPackages": "TotalPackages", "shipToAddress1": "ShipToAddressline1"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 18:37:13.609	2025-10-23 18:37:18.184	2025-10-23 18:37:15.098	2025-10-23 18:37:18.183
cmh3sd9vk0004vi7inzdv6p8h	J112197_GROUND_07-10 & 07-11.xlsx	\N	Test	COMPLETE	1	1	0	1	se-3932358	fedex	fedex_ground	FedEx	FedEx Ground®	third_party	204762943	US	10016	f	f	none	\N	"{\\"zip\\":\\"94520\\",\\"city\\":\\"Concord\\",\\"name\\":\\"Shipping Manager\\",\\"phone\\":\\"9256821111\\",\\"state\\":\\"CA\\",\\"company\\":\\"Calitho\\",\\"country\\":\\"US\\",\\"street1\\":\\"2312 Stanwell Dr\\",\\"street2\\":\\"\\"}"	{"width": "DimensionsW", "height": "DimensionsH", "length": "DimensionsL", "weight": "PackageWeight", "shipDate": "ShipDate", "jobNumber": "Job#", "shipToZip": "ShipToZipCode", "itemNumber": "ItemNumber", "reference1": "Reference1", "reference2": "Reference2", "reference3": "Reference3", "shipToCity": "ShipToCity", "shipToName": "ShipToCompany", "shipToPhone": "ShipToPhoneNo", "shipToState": "ShipToState", "itemQuantity": "ItemQuantity", "packageNumber": "PackageNumber", "shipToCompany": "ShipToName", "shipToCountry": "ShipToCountry", "totalPackages": "TotalPackages", "shipToAddress1": "ShipToAddressline1"}	cmgzzea5200001vtaazq29pyk	\N	2025-10-23 18:59:16.928	2025-10-23 19:00:22.156	2025-10-23 18:59:18.348	2025-10-23 18:59:21.415
\.


--
-- Data for Name: BatchImportMapping; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."BatchImportMapping" (id, "userId", "tenantId", "mappingName", "columnMappings", "isDefault", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: BatchImportRow; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."BatchImportRow" (id, "batchImportId", "rowNumber", status, "groupKey", "shipDate", "jobNumber", "totalPackages", "packageNumber", "shipToName", "shipToCompany", "shipToAddress1", "shipToAddress2", "shipToCity", "shipToState", "shipToZip", "shipToCountry", "shipToPhone", weight, length, width, height, reference1, reference2, reference3, "itemNumber", "itemQuantity", "trackingNumber", "trackingUrl", "labelUrl", "shippingCost", "errorMessage", notes, "retryCount", "maxRetries", "lastAttemptAt", "isTransientError", "paceJobShipmentId", "paceCartonId", "shipstationShipmentId", "shipstationLabelId", "createdAt", "updatedAt", "processedAt") FROM stdin;
cmh3rkwsp0002vi7ivw0shvwt	cmh3rkwsp0001vi7ioccvnnv8	2	FAILED	1-2025-10-23-19555 s. mountain house pkwy-mountain house-ca-95391	2025-10-23 08:00:00	1	1	1	Store Manager	Safeway - Store/Club #55	19555 S. Mountain House Pkwy	\N	Mountain House	CA	95391	US	1111111111	10	10	10	2	Safeway - CL121728	Safeway - CL121728	J112197-A1	64620	1	\N	\N	\N	\N	Labels created but PACE failed: PACE API error: 500 - {"message":"charges, This enumerated list field contains a value that is no longer in the associated list. value: ThirdParty/ShipBillTo: JobShipment[charges=ThirdParty/ShipBillTo]"}	\N	1	3	2025-10-23 18:37:15.243	f	\N	\N	\N	\N	2025-10-23 18:37:13.609	2025-10-23 18:37:17.892	2025-10-23 18:37:17.891
cmh3sd9vk0005vi7ims5sc47u	cmh3sd9vk0004vi7inzdv6p8h	2	FAILED	1-2025-10-23-19555 s. mountain house pkwy-mountain house-ca-95391	2025-10-23 08:00:00	1	1	1	Store Manager	Safeway - Store/Club #55	19555 S. Mountain House Pkwy	\N	Mountain House	CA	95391	US	1111111111	10	10	10	2	Safeway - CL121728	Safeway - CL121728	J112197-A1	64620	1	\N	\N	\N	0	Label voided by user	\N	1	3	2025-10-23 18:59:18.495	f	140008	153798	se-159778613	se-74196070	2025-10-23 18:59:16.928	2025-10-23 19:00:21.577	2025-10-23 18:59:20.978
\.


--
-- Data for Name: CarrierServiceMapping; Type: TABLE DATA; Schema: public; Owner: -
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
-- Data for Name: Integration; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Integration" (id, provider, enabled, config, "secretName", "tenantId", "createdAt", "updatedAt") FROM stdin;
cmgzzflfv0001cqkboq8nvgvi	shipstation	t	{"mode": "production", "carriers": [{"id": "se-3933051", "name": "UPS"}, {"id": "se-3932358", "name": "FedEx"}, {"id": "se-3932298", "name": "GLS"}], "carrierIds": ["se-3933051", "se-3932358", "se-3932298"], "defaultFromAddress": {"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}}	calitho-suite/integrations/shipstation/cmgzzea5200001vtaazq29pyk	cmgzzea5200001vtaazq29pyk	2025-10-21 03:05:57.834	2025-10-22 17:06:19.334
\.


--
-- Data for Name: Job; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Job" (id, type, status, payload, result, error, progress, "createdAt", "updatedAt", "completedAt") FROM stdin;
\.


--
-- Data for Name: Membership; Type: TABLE DATA; Schema: public; Owner: -
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
\.


--
-- Data for Name: MenuConfiguration; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."MenuConfiguration" (id, "menuKey", label, href, icon, "parentKey", "order", "visibleToRoles", "isActive", "tenantId", "createdAt", "updatedAt") FROM stdin;
cmh1d5p7v000agy61rm6w5jt2	dashboard	Dashboard	/dashboard	home	\N	0	{full_admin,admin,customer_service,estimator,logistics,accounting}	t	cmgzzea5200001vtaazq29pyk	2025-10-22 02:17:56.971	2025-10-23 15:18:59.861
cmh2xypox0003efc1yso98pu1	open-jobs	Open Jobs	/open-jobs	document	\N	1	{full_admin,admin}	t	cmgzzea5200001vtaazq29pyk	2025-10-23 04:48:09.105	2025-10-23 15:18:59.861
cmh1d5p7v000bgy61xvfq1ggy	shipments	Shipments	/shipments	package	\N	2	{admin,customer_service,logistics,full_admin}	t	cmgzzea5200001vtaazq29pyk	2025-10-22 02:17:56.971	2025-10-23 15:18:59.861
cmh1d5p7v000fgy61g786vasq	batch-import	Batch Import	/batch-import	upload	\N	3	{full_admin,admin,logistics}	t	cmgzzea5200001vtaazq29pyk	2025-10-22 02:17:56.971	2025-10-23 15:18:59.861
cmh1d5p7v000igy61zfdfidkk	rate-estimates	Rate Estimates	/rates/estimate	dollar	\N	4	{full_admin,admin,estimator,logistics}	t	cmgzzea5200001vtaazq29pyk	2025-10-22 02:17:56.971	2025-10-23 15:18:59.861
cmh1d5p7v000jgy61emew43ix	settings	Settings	/settings	settings	\N	5	{full_admin,admin}	t	cmgzzea5200001vtaazq29pyk	2025-10-22 02:17:56.971	2025-10-23 15:18:59.861
cmh1d5p7v000ggy61vw2u99k2	batch-import-new	New Import	/batch-import	plus	batch-import	1	{full_admin,admin,logistics}	t	cmgzzea5200001vtaazq29pyk	2025-10-22 02:17:56.971	2025-10-23 15:18:59.861
cmh1d5p7v000cgy61dwmy5wv3	shipments-all	All Shipments	/shipments	list	shipments	2	{admin,customer_service,logistics,full_admin}	t	cmgzzea5200001vtaazq29pyk	2025-10-22 02:17:56.971	2025-10-23 15:18:59.861
cmh1d5p7v000dgy61rqd3em28	shipments-manual-label	Manual Label	/shipments/manual-label	plus	shipments	4	{admin,customer_service,full_admin,logistics}	t	cmgzzea5200001vtaazq29pyk	2025-10-22 02:17:56.971	2025-10-23 15:18:59.861
cmh1d5p7v000hgy61asywggzp	batch-import-track	Track Batches	/batch-import/batches	search	batch-import	5	{full_admin,admin,logistics}	t	cmgzzea5200001vtaazq29pyk	2025-10-22 02:17:56.971	2025-10-23 15:18:59.861
cmh1d5p7v000egy61vfmu4sok	shipments-track	Track Labels	/shipment-track	search	shipments	6	{admin,customer_service,logistics,full_admin}	t	cmgzzea5200001vtaazq29pyk	2025-10-22 02:17:56.971	2025-10-23 15:18:59.861
\.


--
-- Data for Name: Order; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Order" (id, "orderNumber", status, "customerName", "customerEmail", "customerPhone", subtotal, tax, total, currency, "shippingAddress", "billingAddress", notes, metadata, "tenantId", "createdAt", "updatedAt") FROM stdin;
cmh00adzg000b10q0gsv98tgc	ORD-00001	processing	Customer 1	customer1@example.com	+1-555-0001	100.00	10.00	110.00	USD	null	null	\N	null	cmh00abda000010q001zanzlt	2025-10-21 03:29:54.508	2025-10-21 03:29:54.508
cmh00aebr000f10q0lt6gfvf6	ORD-00002	shipped	Customer 2	customer2@example.com	+1-555-0002	200.00	20.00	220.00	USD	null	null	\N	null	cmh00abda000010q001zanzlt	2025-10-21 03:29:54.951	2025-10-21 03:29:54.951
cmh00aekq000j10q0n4d5p2a6	ORD-00003	pending	Customer 3	customer3@example.com	+1-555-0003	300.00	30.00	330.00	USD	null	null	\N	null	cmh00abda000010q001zanzlt	2025-10-21 03:29:55.275	2025-10-21 03:29:55.275
cmh00aetr000n10q0wgefph9g	ORD-00004	processing	Customer 4	customer4@example.com	+1-555-0004	400.00	40.00	440.00	USD	null	null	\N	null	cmh00abda000010q001zanzlt	2025-10-21 03:29:55.599	2025-10-21 03:29:55.599
cmh00af2q000r10q095awmcta	ORD-00005	shipped	Customer 5	customer5@example.com	+1-555-0005	500.00	50.00	550.00	USD	null	null	\N	null	cmh00abda000010q001zanzlt	2025-10-21 03:29:55.922	2025-10-21 03:29:55.922
\.


--
-- Data for Name: OrderItem; Type: TABLE DATA; Schema: public; Owner: -
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
-- Data for Name: Session; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Session" (id, "sessionToken", "userId", expires) FROM stdin;
cmh2mitpi0001hm9sz6kuvhpa	jwt-cmh1jlf1d000fc5r6i4lkjlgk-1761175672038	cmh1jlf1d000fc5r6i4lkjlgk	2025-11-21 23:32:54.216
cmh2hdn3w000jh33j81vom5s9	jwt-cmh1jimiw0000c5r673dqamec-1761167032123	cmh1jimiw0000c5r673dqamec	2025-11-21 23:44:14.771
cmh3is9qw0013mx8411m0s03q	jwt-cmgzzeaa500011vtanifj1f2k-1761229860440	cmgzzeaa500011vtanifj1f2k	2025-11-22 20:55:58.363
\.


--
-- Data for Name: ShipmentTypeMapping; Type: TABLE DATA; Schema: public; Owner: -
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
-- Data for Name: ShippingLabel; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ShippingLabel" (id, "paceShipmentId", "paceCartonId", provider, "providerShipmentId", "providerLabelId", "trackingNumber", "labelUrl", "labelFormat", carrier, service, "shipFrom", "shipTo", weight, length, width, height, cost, currency, status, "voidedAt", "refundedAt", "isReturnLabel", "outboundLabelId", "rmaNumber", metadata, "tenantId", "createdAt", "updatedAt", "lastTrackedAt", "trackingStatus") FROM stdin;
cmh2itczv000ph33j7f4srxss	139073	153752	shipstation	se-159278489	se-73932848	394547095471	https://api.shipengine.com/v1/downloads/14/7aD71_8oEkWGNyyhyNr4uA/label-73932848.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "55414", "city": "MINNEAPOLIS", "name": "Soona / Ref # 412692", "email": "", "phone": "(000) 000-0000", "state": "MN", "company": "", "country": "US", "street1": "1621 E. Hennepin Ave.", "street2": "Suite 105"}	8.00	8.00	20.00	6.00	21.37	USD	voided	\N	\N	f	\N	\N	{"reference1": "112865 - CL139073", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-22 21:44:05.131	2025-10-22 21:45:06.667	\N	\N
cmh2j3cba000th33jtdw79kjx	139073	153753	shipstation	se-159282832	se-73934970	394547337514	https://api.shipengine.com/v1/downloads/14/fQfZbSEJrk-nJyVGw62_jg/label-73934970.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "55414", "city": "MINNEAPOLIS", "name": "Soona / Ref # 412692", "email": "", "phone": "(000) 000-0000", "state": "MN", "company": "", "country": "US", "street1": "1621 E. Hennepin Ave.", "street2": "Suite 105"}	8.00	8.00	20.00	6.00	21.37	USD	voided	\N	\N	f	\N	\N	{"reference1": "112865 - CL139073", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-22 21:51:50.806	2025-10-22 21:52:53.597	\N	\N
cmh2jrxe70001qtzgvbx56bxs	139979	153755	shipstation	se-159292813	se-73939108	394547861670	https://api.shipengine.com/v1/downloads/14/rt2p3NibH0yHsCHUpMCySA/label-73939108.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "55414", "city": "MINNEAPOLIS", "name": "Soona /", "email": "", "phone": "0000000000", "state": "MN", "company": "Soona / Ref # 412692", "country": "US", "street1": "1621 E. Hennepin Ave.", "street2": "Suite 105"}	10.00	10.00	20.00	6.00	21.37	USD	voided	\N	\N	f	\N	\N	{"reference1": "1 - CL139979", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-22 22:10:57.871	2025-10-22 22:13:34.272	\N	\N
cmh2kbg2z0005qtzgo03edoi6	139073	153758	shipstation	se-159299917	se-73941699	394548239381	https://api.shipengine.com/v1/downloads/14/9csb1Ow3u0ilJclhtl5rqg/label-73941699.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "55414", "city": "MINNEAPOLIS", "name": "Soona /", "email": "", "phone": "0000000000", "state": "MN", "company": "Soona / Ref # 412692", "country": "US", "street1": "1621 E. Hennepin Ave.", "street2": "Suite 105"}	10.00	10.00	\N	\N	0.00	USD	voided	\N	\N	f	\N	\N	{"reference1": "112865 - CL139073", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-22 22:26:08.555	2025-10-22 22:27:11.002	\N	\N
cmh2jxiad0003qtzgv4wsygux	139979	153756	shipstation	se-159294689	se-73939824	394547970174	https://api.shipengine.com/v1/downloads/14/kA7I2OZeoUWx3GZ7FXlVZQ/label-73939824.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "55414", "city": "MINNEAPOLIS", "name": "Soona /", "email": "", "phone": "0000000000", "state": "MN", "company": "Soona / Ref # 412692", "country": "US", "street1": "1621 E. Hennepin Ave.", "street2": "Suite 105"}	1.00	1.00	10.00	10.00	0.00	USD	voided	\N	\N	f	\N	\N	{"reference1": "1 - CL139979", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-22 22:15:18.229	2025-10-22 22:35:53.671	\N	\N
cmh2kpt1w0007qtzg9g90uqgg	139979	153764	shipstation	se-159305296	se-73943514	394548503389	https://api.shipengine.com/v1/downloads/14/EXuN61wfLkKykYNffifKuA/label-73943514.pdf	pdf	FedEx	FedEx Ground®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "55414", "city": "MINNEAPOLIS", "name": "Soona /", "email": "", "phone": "0000000000", "state": "MN", "company": "Soona / Ref # 412692", "country": "US", "street1": "1621 E. Hennepin Ave.", "street2": "Suite 105"}	10.00	10.00	\N	\N	0.00	USD	voided	\N	\N	f	\N	\N	{"reference1": "1 - CL139979", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-22 22:37:18.549	2025-10-22 22:37:54.908	\N	\N
cmh2ku48i000vh33jeyzr3ekn	139978	153765	shipstation	se-159306764	se-73943950	1Z9634841394115199	https://api.shipengine.com/v1/downloads/14/-kkEj-aINESDcVw3khyxOA/label-73943950.pdf	pdf	UPS	UPS Next Day Air Saver®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "94602", "city": "Oakland", "name": "Maxine Ressler", "email": "", "phone": "", "state": "CA", "company": "", "country": "US", "street1": "2615 Madeline Street", "street2": ""}	1.00	1.00	11.00	2.00	17.94	USD	active	\N	\N	f	\N	\N	{"tracking": {"ship_date": "2025-10-22T22:52:18Z", "last_event": {"event_code": "I", "description": "Out for Delivery", "occurred_at": "2025-10-23T16:23:33Z", "postal_code": "", "country_code": "US", "city_locality": "Oakland", "state_province": "CA", "event_description": "Out for Delivery", "carrier_occurred_at": "2025-10-23T09:23:33Z"}, "updated_at": "2025-10-23T16:24:45.496Z", "status_code": "IT", "status_description": "In Transit", "carrier_status_code": "I", "actual_delivery_date": null, "exception_description": null, "estimated_delivery_date": "2025-10-23T00:00:00Z", "carrier_status_description": "Out for Delivery"}}	cmgzzea5200001vtaazq29pyk	2025-10-22 22:40:39.666	2025-10-23 16:24:45.497	2025-10-23 16:24:45.496	in_transit
cmh2l28lv000zh33j19y47tsw	139976	153767	shipstation	se-159309256	se-73944782	1Z9634841399247181	https://api.shipengine.com/v1/downloads/14/gsfjS8UtJkO1t0J_sVgFug/label-73944782.pdf	pdf	UPS	UPS Next Day Air Saver®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "94558", "city": "Napa", "name": "Maggie Minnick", "email": "", "phone": "7079630134", "state": "CA", "company": "Maggie Minnick", "country": "US", "street1": "1175 El Centro Avenue", "street2": ""}	1.00	1.00	11.00	2.00	21.41	USD	delivered	\N	\N	f	\N	\N	{"tracking": {"ship_date": "2025-10-22T22:52:18Z", "last_event": {"event_code": "D", "description": "Delivered", "occurred_at": "2025-10-23T18:01:43Z", "postal_code": "94558", "country_code": "US", "city_locality": "NAPA", "state_province": "CA", "event_description": "Delivered", "carrier_occurred_at": "2025-10-23T11:01:43Z"}, "updated_at": "2025-10-23T18:03:32.664Z", "status_code": "DE", "status_description": "Delivered", "carrier_status_code": "D", "actual_delivery_date": "2025-10-23T18:01:43Z", "exception_description": null, "estimated_delivery_date": "2025-10-23T00:00:00Z", "carrier_status_description": "Delivered"}, "reference1": "113032 - CL139976", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-22 22:46:58.579	2025-10-23 18:03:32.666	2025-10-23 18:03:32.665	delivered
cmh2ky6tu000xh33jexln04ft	139977	153766	shipstation	se-159308068	se-73944355	1Z9634841399869572	https://api.shipengine.com/v1/downloads/14/VHJltTpFpkWffC6M2sMw9Q/label-73944355.pdf	pdf	UPS	UPS Next Day Air Saver®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "94952", "city": "Petaluma", "name": "Madeleine Corson", "email": "madeleine@corsondesign.com", "phone": "4157772492", "state": "CA", "company": "Corson Design", "country": "US", "street1": "405 Gericke Rd", "street2": ""}	1.00	1.00	11.00	2.00	21.41	USD	delivered	\N	\N	f	\N	\N	{"tracking": {"ship_date": "2025-10-22T22:52:18Z", "last_event": {"event_code": "D", "description": "Delivered", "occurred_at": "2025-10-23T18:03:00Z", "postal_code": "94952", "country_code": "US", "city_locality": "PETALUMA", "state_province": "CA", "event_description": "Delivered", "carrier_occurred_at": "2025-10-23T11:03:00Z"}, "updated_at": "2025-10-23T18:05:11.013Z", "status_code": "DE", "status_description": "Delivered", "carrier_status_code": "D", "actual_delivery_date": "2025-10-23T18:03:00Z", "exception_description": null, "estimated_delivery_date": "2025-10-23T00:00:00Z", "carrier_status_description": "Delivered"}}	cmgzzea5200001vtaazq29pyk	2025-10-22 22:43:49.651	2025-10-23 18:05:11.014	2025-10-23 18:05:11.013	delivered
cmh2hlpi4000lh33jkpxds3he	139954	153750	shipstation	se-159261107	se-73924398	1Z9634840190659177	https://api.shipengine.com/v1/downloads/14/A3vWqZFCVkWlUDzyUlIVJQ/label-73924398.pdf	pdf	UPS	UPS Next Day Air®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "95834", "city": "SACRAMENTO", "name": "MELANIE WARD", "email": "", "phone": "0000000000", "state": "CA", "company": "WIKOFF COLOR CORPORATION", "country": "US", "street1": "1329 N. MARKET BLVD.", "street2": "SUITE 160"}	1.00	1.00	10.00	1.00	16.80	USD	delivered	\N	\N	f	\N	\N	{"tracking": {"ship_date": "2025-10-22T21:10:07Z", "last_event": {"event_code": "D", "description": "Commercial Inside Release", "occurred_at": "2025-10-23T17:06:22Z", "postal_code": "95834", "country_code": "US", "city_locality": "SACRAMENTO", "state_province": "CA", "event_description": "Commercial Inside Release", "carrier_occurred_at": "2025-10-23T10:06:22Z"}, "updated_at": "2025-10-23T17:10:24.060Z", "status_code": "DE", "status_description": "Delivered", "carrier_status_code": "D", "actual_delivery_date": "2025-10-23T17:06:22Z", "exception_description": null, "estimated_delivery_date": "2025-10-23T00:00:00Z", "carrier_status_description": "Commercial Inside Release"}, "reference1": "1 - CL139954", "reference2": null, "reference3": null}	cmgzzea5200001vtaazq29pyk	2025-10-22 21:10:08.476	2025-10-23 17:10:24.061	2025-10-23 17:10:24.06	delivered
cmh2huoy0000nh33jewlhq9l5	139957	153751	shipstation	se-159265066	se-73926193	1Z9634840191681186	https://api.shipengine.com/v1/downloads/14/ClGm-5SoukmYsz0yo60q7A/label-73926193.pdf	pdf	UPS	UPS Next Day Air®	{"zip": "94520", "city": "Concord", "name": "Shipping Manager", "phone": "9256821111", "state": "CA", "company": "Calitho", "country": "US", "street1": "2312 Stanwell Dr", "street2": ""}	{"zip": "84048", "city": "LEHI", "name": "BRITTANY RHODES", "email": "evelyne@calitho.com", "phone": "0000000000", "state": "UT", "company": "FOUNT SOCIETY", "country": "US", "street1": "3401 North Thanksgiving Way", "street2": "Suite 300"}	1.00	1.00	10.00	1.00	18.78	USD	delivered	\N	\N	f	\N	\N	{"tracking": {"ship_date": "2025-10-22T22:52:18Z", "last_event": {"event_code": "D", "description": "Commercial Inside Release", "occurred_at": "2025-10-23T15:46:08Z", "postal_code": "84048", "country_code": "US", "city_locality": "LEHI", "state_province": "UT", "event_description": "Commercial Inside Release", "carrier_occurred_at": "2025-10-23T09:46:08Z"}, "updated_at": "2025-10-23T15:53:50.848Z", "status_code": "DE", "status_description": "Delivered", "carrier_status_code": "D", "actual_delivery_date": "2025-10-23T15:46:08Z", "exception_description": null, "estimated_delivery_date": "2025-10-23T00:00:00Z", "carrier_status_description": "Commercial Inside Release"}}	cmgzzea5200001vtaazq29pyk	2025-10-22 21:17:07.656	2025-10-23 15:53:50.849	2025-10-23 15:53:50.848	delivered
cmh3sdd430001mke2eti4gdbc	140008	153798	shipstation	se-159778613	se-74196070	394580770682	https://api.shipengine.com/v1/downloads/14/97Z1IulP9EuKs0gKqlFIEg/label-74196070.pdf	\N	se-3932358	fedex_ground	"{\\"zip\\":\\"94520\\",\\"city\\":\\"Concord\\",\\"name\\":\\"Shipping Manager\\",\\"phone\\":\\"9256821111\\",\\"state\\":\\"CA\\",\\"company\\":\\"Calitho\\",\\"country\\":\\"US\\",\\"street1\\":\\"2312 Stanwell Dr\\",\\"street2\\":\\"\\"}"	{"name": "Store Manager", "phone": "1111111111", "postal_code": "95391", "company_name": "Safeway - Store/Club #55", "country_code": "US", "address_line1": "19555 S. Mountain House Pkwy", "address_line2": null, "city_locality": "Mountain House", "state_province": "CA"}	10.00	10.00	10.00	2.00	0.00	USD	voided	\N	\N	f	\N	\N	{"jobNumber": "1", "reference1": "Safeway - CL121728", "reference2": "Safeway - CL121728", "reference3": "J112197-A1", "batchImportId": "cmh3sd9vk0004vi7inzdv6p8h", "packageNumber": 1, "totalPackages": 1, "batchImportRowId": "cmh3sd9vk0005vi7ims5sc47u"}	cmgzzea5200001vtaazq29pyk	2025-10-23 18:59:21.123	2025-10-23 19:00:21.73	\N	\N
\.


--
-- Data for Name: Tenant; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Tenant" (id, name, slug, plan, status, metadata, "createdAt", "updatedAt") FROM stdin;
cmgzzea5200001vtaazq29pyk	Calitho	calitho	enterprise	active	null	2025-10-21 03:04:56.534	2025-10-21 03:04:56.534
cmh00abda000010q001zanzlt	Demo Company	demo	pro	active	null	2025-10-21 03:29:51.118	2025-10-21 03:29:51.118
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
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
\.


--
-- Data for Name: VerificationToken; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."VerificationToken" (identifier, token, expires) FROM stdin;
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
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
\.


--
-- Name: Account Account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY (id);


--
-- Name: Attachment Attachment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: BatchImportMapping BatchImportMapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BatchImportMapping"
    ADD CONSTRAINT "BatchImportMapping_pkey" PRIMARY KEY (id);


--
-- Name: BatchImportRow BatchImportRow_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BatchImportRow"
    ADD CONSTRAINT "BatchImportRow_pkey" PRIMARY KEY (id);


--
-- Name: BatchImport BatchImport_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BatchImport"
    ADD CONSTRAINT "BatchImport_pkey" PRIMARY KEY (id);


--
-- Name: CarrierServiceMapping CarrierServiceMapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CarrierServiceMapping"
    ADD CONSTRAINT "CarrierServiceMapping_pkey" PRIMARY KEY (id);


--
-- Name: Integration Integration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Integration"
    ADD CONSTRAINT "Integration_pkey" PRIMARY KEY (id);


--
-- Name: Job Job_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Job"
    ADD CONSTRAINT "Job_pkey" PRIMARY KEY (id);


--
-- Name: Membership Membership_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Membership"
    ADD CONSTRAINT "Membership_pkey" PRIMARY KEY (id);


--
-- Name: MenuConfiguration MenuConfiguration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MenuConfiguration"
    ADD CONSTRAINT "MenuConfiguration_pkey" PRIMARY KEY (id);


--
-- Name: OrderItem OrderItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_pkey" PRIMARY KEY (id);


--
-- Name: Order Order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: ShipmentTypeMapping ShipmentTypeMapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ShipmentTypeMapping"
    ADD CONSTRAINT "ShipmentTypeMapping_pkey" PRIMARY KEY (id);


--
-- Name: ShippingLabel ShippingLabel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ShippingLabel"
    ADD CONSTRAINT "ShippingLabel_pkey" PRIMARY KEY (id);


--
-- Name: Tenant Tenant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tenant"
    ADD CONSTRAINT "Tenant_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Account_provider_providerAccountId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON public."Account" USING btree (provider, "providerAccountId");


--
-- Name: Account_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Account_userId_idx" ON public."Account" USING btree ("userId");


--
-- Name: Attachment_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Attachment_key_idx" ON public."Attachment" USING btree (key);


--
-- Name: Attachment_orderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Attachment_orderId_idx" ON public."Attachment" USING btree ("orderId");


--
-- Name: Attachment_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Attachment_tenantId_idx" ON public."Attachment" USING btree ("tenantId");


--
-- Name: AuditLog_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_action_idx" ON public."AuditLog" USING btree (action);


--
-- Name: AuditLog_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_createdAt_idx" ON public."AuditLog" USING btree ("createdAt");


--
-- Name: AuditLog_entityType_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_entityType_entityId_idx" ON public."AuditLog" USING btree ("entityType", "entityId");


--
-- Name: AuditLog_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_tenantId_idx" ON public."AuditLog" USING btree ("tenantId");


--
-- Name: AuditLog_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_userId_idx" ON public."AuditLog" USING btree ("userId");


--
-- Name: BatchImportMapping_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BatchImportMapping_tenantId_idx" ON public."BatchImportMapping" USING btree ("tenantId");


--
-- Name: BatchImportMapping_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BatchImportMapping_userId_idx" ON public."BatchImportMapping" USING btree ("userId");


--
-- Name: BatchImportRow_batchImportId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BatchImportRow_batchImportId_idx" ON public."BatchImportRow" USING btree ("batchImportId");


--
-- Name: BatchImportRow_batchImportId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BatchImportRow_batchImportId_status_idx" ON public."BatchImportRow" USING btree ("batchImportId", status);


--
-- Name: BatchImportRow_groupKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BatchImportRow_groupKey_idx" ON public."BatchImportRow" USING btree ("groupKey");


--
-- Name: BatchImportRow_jobNumber_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BatchImportRow_jobNumber_idx" ON public."BatchImportRow" USING btree ("jobNumber");


--
-- Name: BatchImportRow_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BatchImportRow_status_idx" ON public."BatchImportRow" USING btree (status);


--
-- Name: BatchImport_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BatchImport_createdAt_idx" ON public."BatchImport" USING btree ("createdAt");


--
-- Name: BatchImport_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BatchImport_status_idx" ON public."BatchImport" USING btree (status);


--
-- Name: BatchImport_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BatchImport_tenantId_idx" ON public."BatchImport" USING btree ("tenantId");


--
-- Name: CarrierServiceMapping_shipstationCarrierCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CarrierServiceMapping_shipstationCarrierCode_idx" ON public."CarrierServiceMapping" USING btree ("shipstationCarrierCode");


--
-- Name: CarrierServiceMapping_shipstationServiceCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CarrierServiceMapping_shipstationServiceCode_idx" ON public."CarrierServiceMapping" USING btree ("shipstationServiceCode");


--
-- Name: CarrierServiceMapping_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CarrierServiceMapping_tenantId_idx" ON public."CarrierServiceMapping" USING btree ("tenantId");


--
-- Name: CarrierServiceMapping_tenantId_shipstationCarrierId_shipsta_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CarrierServiceMapping_tenantId_shipstationCarrierId_shipsta_key" ON public."CarrierServiceMapping" USING btree ("tenantId", "shipstationCarrierId", "shipstationServiceCode");


--
-- Name: Integration_enabled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Integration_enabled_idx" ON public."Integration" USING btree (enabled);


--
-- Name: Integration_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Integration_provider_idx" ON public."Integration" USING btree (provider);


--
-- Name: Integration_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Integration_tenantId_idx" ON public."Integration" USING btree ("tenantId");


--
-- Name: Integration_tenantId_provider_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Integration_tenantId_provider_key" ON public."Integration" USING btree ("tenantId", provider);


--
-- Name: Job_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Job_createdAt_idx" ON public."Job" USING btree ("createdAt");


--
-- Name: Job_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Job_status_idx" ON public."Job" USING btree (status);


--
-- Name: Job_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Job_type_idx" ON public."Job" USING btree (type);


--
-- Name: Membership_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Membership_tenantId_idx" ON public."Membership" USING btree ("tenantId");


--
-- Name: Membership_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Membership_userId_idx" ON public."Membership" USING btree ("userId");


--
-- Name: Membership_userId_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Membership_userId_tenantId_key" ON public."Membership" USING btree ("userId", "tenantId");


--
-- Name: MenuConfiguration_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MenuConfiguration_order_idx" ON public."MenuConfiguration" USING btree ("order");


--
-- Name: MenuConfiguration_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MenuConfiguration_tenantId_idx" ON public."MenuConfiguration" USING btree ("tenantId");


--
-- Name: MenuConfiguration_tenantId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "MenuConfiguration_tenantId_isActive_idx" ON public."MenuConfiguration" USING btree ("tenantId", "isActive");


--
-- Name: MenuConfiguration_tenantId_menuKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MenuConfiguration_tenantId_menuKey_key" ON public."MenuConfiguration" USING btree ("tenantId", "menuKey");


--
-- Name: OrderItem_orderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OrderItem_orderId_idx" ON public."OrderItem" USING btree ("orderId");


--
-- Name: Order_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_createdAt_idx" ON public."Order" USING btree ("createdAt");


--
-- Name: Order_customerEmail_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_customerEmail_idx" ON public."Order" USING btree ("customerEmail");


--
-- Name: Order_orderNumber_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_orderNumber_idx" ON public."Order" USING btree ("orderNumber");


--
-- Name: Order_orderNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Order_orderNumber_key" ON public."Order" USING btree ("orderNumber");


--
-- Name: Order_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_status_idx" ON public."Order" USING btree (status);


--
-- Name: Order_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Order_tenantId_idx" ON public."Order" USING btree ("tenantId");


--
-- Name: Session_sessionToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Session_sessionToken_key" ON public."Session" USING btree ("sessionToken");


--
-- Name: Session_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Session_userId_idx" ON public."Session" USING btree ("userId");


--
-- Name: ShipmentTypeMapping_tenantId_completedTypeId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ShipmentTypeMapping_tenantId_completedTypeId_key" ON public."ShipmentTypeMapping" USING btree ("tenantId", "completedTypeId");


--
-- Name: ShipmentTypeMapping_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ShipmentTypeMapping_tenantId_idx" ON public."ShipmentTypeMapping" USING btree ("tenantId");


--
-- Name: ShipmentTypeMapping_tenantId_plannedTypeId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ShipmentTypeMapping_tenantId_plannedTypeId_key" ON public."ShipmentTypeMapping" USING btree ("tenantId", "plannedTypeId");


--
-- Name: ShippingLabel_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ShippingLabel_createdAt_idx" ON public."ShippingLabel" USING btree ("createdAt");


--
-- Name: ShippingLabel_isReturnLabel_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ShippingLabel_isReturnLabel_idx" ON public."ShippingLabel" USING btree ("isReturnLabel");


--
-- Name: ShippingLabel_paceCartonId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ShippingLabel_paceCartonId_idx" ON public."ShippingLabel" USING btree ("paceCartonId");


--
-- Name: ShippingLabel_paceShipmentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ShippingLabel_paceShipmentId_idx" ON public."ShippingLabel" USING btree ("paceShipmentId");


--
-- Name: ShippingLabel_provider_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ShippingLabel_provider_idx" ON public."ShippingLabel" USING btree (provider);


--
-- Name: ShippingLabel_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ShippingLabel_status_idx" ON public."ShippingLabel" USING btree (status);


--
-- Name: ShippingLabel_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ShippingLabel_tenantId_idx" ON public."ShippingLabel" USING btree ("tenantId");


--
-- Name: ShippingLabel_trackingNumber_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ShippingLabel_trackingNumber_idx" ON public."ShippingLabel" USING btree ("trackingNumber");


--
-- Name: ShippingLabel_trackingStatus_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ShippingLabel_trackingStatus_idx" ON public."ShippingLabel" USING btree ("trackingStatus");


--
-- Name: Tenant_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Tenant_slug_idx" ON public."Tenant" USING btree (slug);


--
-- Name: Tenant_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Tenant_slug_key" ON public."Tenant" USING btree (slug);


--
-- Name: Tenant_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Tenant_status_idx" ON public."Tenant" USING btree (status);


--
-- Name: User_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_email_idx" ON public."User" USING btree (email);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: VerificationToken_identifier_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON public."VerificationToken" USING btree (identifier, token);


--
-- Name: VerificationToken_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "VerificationToken_token_key" ON public."VerificationToken" USING btree (token);


--
-- Name: Account Account_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Attachment Attachment_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Attachment Attachment_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AuditLog AuditLog_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AuditLog AuditLog_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AuditLog AuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BatchImportRow BatchImportRow_batchImportId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BatchImportRow"
    ADD CONSTRAINT "BatchImportRow_batchImportId_fkey" FOREIGN KEY ("batchImportId") REFERENCES public."BatchImport"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BatchImport BatchImport_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BatchImport"
    ADD CONSTRAINT "BatchImport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CarrierServiceMapping CarrierServiceMapping_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CarrierServiceMapping"
    ADD CONSTRAINT "CarrierServiceMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Integration Integration_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Integration"
    ADD CONSTRAINT "Integration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Membership Membership_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Membership"
    ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Membership Membership_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Membership"
    ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: MenuConfiguration MenuConfiguration_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MenuConfiguration"
    ADD CONSTRAINT "MenuConfiguration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderItem OrderItem_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrderItem"
    ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Order Order_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ShipmentTypeMapping ShipmentTypeMapping_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ShipmentTypeMapping"
    ADD CONSTRAINT "ShipmentTypeMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ShippingLabel ShippingLabel_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ShippingLabel"
    ADD CONSTRAINT "ShippingLabel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict yvyoUtC35s5igXfiC0QF3mHrRzk4PR0n9fwczT7W2RIcfExITqtoqBb445UGrVK

