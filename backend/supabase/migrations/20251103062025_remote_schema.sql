

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "btree_gin" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."add_price_history_on_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only add to history if the price actually changed
  IF OLD.market_price IS DISTINCT FROM NEW.market_price THEN
    INSERT INTO price_history (
      card_id,
      price,
      date,
      price_source,
      created_at
    ) VALUES (
      NEW.id,
      NEW.market_price,
      NOW(),
      COALESCE(NEW.market_price_source, 'unknown'),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."add_price_history_on_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_oracle_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- If oracle_id is not provided, generate a new one
  IF NEW.oracle_id IS NULL THEN
    NEW.oracle_id = gen_random_uuid();
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."assign_oracle_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_card_market_price"("card_id_param" "uuid", "days_back" integer DEFAULT 30) RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  sales_avg NUMERIC;
  listings_avg NUMERIC;
  result_price NUMERIC;
BEGIN
  -- Try to get average from recent sales first
  SELECT AVG(oi.price) INTO sales_avg
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  JOIN listings l ON oi.listing_id = l.id
  WHERE l.card_id = card_id_param
    AND o.status = 'completed'
    AND o.completed_at >= NOW() - (days_back || ' days')::INTERVAL;

  -- If we have sales data with at least 3 sales, use it
  IF sales_avg IS NOT NULL AND (
    SELECT COUNT(*) 
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN listings l ON oi.listing_id = l.id
    WHERE l.card_id = card_id_param
      AND o.status = 'completed'
      AND o.completed_at >= NOW() - (days_back || ' days')::INTERVAL
  ) >= 3 THEN
    result_price := sales_avg;
  ELSE
    -- Fall back to current listings average
    SELECT AVG(price) INTO listings_avg
    FROM listings
    WHERE card_id = card_id_param
      AND status = 'active'
      AND quantity > 0;
    
    IF listings_avg IS NOT NULL THEN
      result_price := listings_avg;
    ELSE
      -- Final fallback: use existing market price or minimum
      SELECT COALESCE(market_price, 0.25) INTO result_price
      FROM cards
      WHERE id = card_id_param;
    END IF;
  END IF;

  RETURN ROUND(result_price, 2);
END;
$$;


ALTER FUNCTION "public"."calculate_card_market_price"("card_id_param" "uuid", "days_back" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_card_market_price"("card_id_param" "uuid", "days_back" integer) IS 'Calculate market price for a single card based on recent sales and current listings';



CREATE OR REPLACE FUNCTION "public"."calculate_market_price"("card_id_param" integer) RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  avg_price DECIMAL(10,2);
  recent_price DECIMAL(10,2);
  scryfall_price DECIMAL(10,2);
BEGIN
  -- Get average price from recent platform sales (last 90 days)
  SELECT AVG(oi.price)
  INTO avg_price
  FROM order_items oi
  JOIN listings l ON oi.listing_id = l.id
  JOIN orders o ON oi.order_id = o.id
  WHERE l.card_id = card_id_param 
    AND o.status = 'completed'
    AND o.created_at > NOW() - INTERVAL '90 days';
  
  -- If we have recent sales, use that
  IF avg_price IS NOT NULL THEN
    RETURN avg_price;
  END IF;
  
  -- Otherwise, get most recent listing price
  SELECT l.price
  INTO recent_price
  FROM listings l
  WHERE l.card_id = card_id_param 
    AND l.status = 'active'
    AND l.condition = 'near_mint'
  ORDER BY l.created_at DESC
  LIMIT 1;
  
  -- If we have a recent listing, use that
  IF recent_price IS NOT NULL THEN
    RETURN recent_price;
  END IF;
  
  -- Finally, fall back to Scryfall price
  SELECT (c.prices->>'usd')::DECIMAL(10,2)
  INTO scryfall_price
  FROM cards c
  WHERE c.id = card_id_param;
  
  RETURN COALESCE(scryfall_price, 0.00);
END;
$$;


ALTER FUNCTION "public"."calculate_market_price"("card_id_param" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_seller_earnings"("seller_id" "uuid", "start_date" "date" DEFAULT NULL::"date", "end_date" "date" DEFAULT NULL::"date") RETURNS TABLE("total_earnings" numeric, "total_orders" integer, "platform_fees" numeric)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  commission_rate DECIMAL(5,4) := 0.025; -- 2.5%
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(oi.price * oi.quantity), 0) * (1 - commission_rate) AS total_earnings,
    COUNT(DISTINCT o.id)::INTEGER AS total_orders,
    COALESCE(SUM(oi.price * oi.quantity), 0) * commission_rate AS platform_fees
  FROM orders o
  JOIN order_items oi ON o.id = oi.order_id
  JOIN listings l ON oi.listing_id = l.id
  WHERE l.seller_id = calculate_seller_earnings.seller_id
    AND o.status = 'delivered'
    AND o.payout_processed = false
    AND (start_date IS NULL OR o.delivered_at >= start_date)
    AND (end_date IS NULL OR o.delivered_at <= end_date);
END;
$$;


ALTER FUNCTION "public"."calculate_seller_earnings"("seller_id" "uuid", "start_date" "date", "end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_seller_payout"("p_seller_id" "uuid", "p_order_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    subtotal DECIMAL(10,2);
    platform_fee_rate DECIMAL(5,4) := 0.025; -- 2.5%
    platform_fee DECIMAL(10,2);
    payout DECIMAL(10,2);
BEGIN
    -- Calculate subtotal for seller's items in the order
    SELECT COALESCE(SUM(oi.price_at_time * oi.quantity), 0)
    INTO subtotal
    FROM order_items oi
    JOIN listings l ON oi.listing_id = l.id
    WHERE oi.order_id = p_order_id
    AND l.seller_id = p_seller_id;
    
    -- Calculate platform fee
    platform_fee := subtotal * platform_fee_rate;
    
    -- Calculate final payout
    payout := subtotal - platform_fee;
    
    RETURN payout;
END;
$$;


ALTER FUNCTION "public"."calculate_seller_payout"("p_seller_id" "uuid", "p_order_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_seller_payout"("p_seller_id" "uuid", "p_order_id" "uuid") IS 'Calculates seller payout after platform fees';



CREATE OR REPLACE FUNCTION "public"."check_price_alerts_on_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only proceed if market_price has changed
  IF OLD.market_price IS DISTINCT FROM NEW.market_price THEN
    -- Find all wishlist items with price alerts for this card
    INSERT INTO price_alert_notifications (
      user_id,
      card_id,
      alert_price,
      current_price,
      triggered_at
    )
    SELECT 
      w.user_id,
      w.card_id,
      w.max_price,
      NEW.market_price,
      NOW()
    FROM wishlists w
    WHERE w.card_id = NEW.id
      AND w.max_price IS NOT NULL
      AND NEW.market_price <= w.max_price
      AND (OLD.market_price > w.max_price OR OLD.market_price IS NULL);
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_price_alerts_on_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_deleted_user_data"("deleted_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- This function can be called after user deletion to ensure cleanup
  -- It's mainly for logging and verification purposes
  INSERT INTO deleted_accounts_log (
    user_id,
    deleted_at,
    deletion_method
  ) VALUES (
    deleted_user_id,
    NOW(),
    'user_requested'
  );
END;
$$;


ALTER FUNCTION "public"."cleanup_deleted_user_data"("deleted_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_checkout_sessions"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE checkout_sessions 
    SET 
        status = 'expired',
        updated_at = NOW()
    WHERE 
        status = 'initialized' 
        AND expires_at < NOW();
        
    -- Log cleanup activity
    INSERT INTO helcim_transaction_logs (
        transaction_type,
        status,
        transaction_data,
        created_at
    ) VALUES (
        'cleanup',
        'success',
        jsonb_build_object(
            'action', 'expired_sessions_cleanup',
            'expired_count', (
                SELECT COUNT(*) 
                FROM checkout_sessions 
                WHERE status = 'expired' 
                AND updated_at > NOW() - INTERVAL '1 minute'
            )
        ),
        NOW()
    );
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_checkout_sessions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_shared_wishlists"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM shared_wishlists 
  WHERE expires_at < NOW() - INTERVAL '7 days'; -- Keep for 7 days after expiry
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_shared_wishlists"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_saved_searches"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM saved_searches 
  WHERE created_at < NOW() - INTERVAL '2 years'
    AND alert_enabled = false;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_saved_searches"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_security_logs"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Keep only last 90 days of security logs
  DELETE FROM security_logs 
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;


ALTER FUNCTION "public"."cleanup_old_security_logs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrease_listing_quantity"("listing_id" "uuid", "quantity_sold" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE listings 
  SET 
    quantity = quantity - quantity_sold,
    updated_at = NOW()
  WHERE id = listing_id;
  
  -- Mark as sold if quantity reaches 0
  UPDATE listings 
  SET status = 'sold'
  WHERE id = listing_id AND quantity <= 0;
END;
$$;


ALTER FUNCTION "public"."decrease_listing_quantity"("listing_id" "uuid", "quantity_sold" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_listing_quantity"("listing_id" "uuid", "quantity_to_subtract" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE listings 
  SET 
    quantity = GREATEST(0, quantity - quantity_to_subtract),
    updated_at = NOW()
  WHERE id = listing_id;
END;
$$;


ALTER FUNCTION "public"."decrement_listing_quantity"("listing_id" "uuid", "quantity_to_subtract" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_card_price_trend"("card_id_param" "uuid", "days_back" integer DEFAULT 90) RETURNS TABLE("date" "date", "price" numeric, "source" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ph.date::DATE,
    ph.price,
    ph.price_source
  FROM price_history ph
  WHERE ph.card_id = card_id_param
    AND ph.date >= NOW() - (days_back || ' days')::INTERVAL
  ORDER BY ph.date ASC;
END;
$$;


ALTER FUNCTION "public"."get_card_price_trend"("card_id_param" "uuid", "days_back" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_card_price_trend"("card_id_param" "uuid", "days_back" integer) IS 'Get price history for a card over specified time period';



CREATE OR REPLACE FUNCTION "public"."get_search_suggestions"("search_term" "text", "suggestion_limit" integer DEFAULT 10) RETURNS TABLE("suggestion_text" "text", "suggestion_type" "text", "relevance_score" real)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  -- Card names
  SELECT 
    c.name as suggestion_text,
    'card' as suggestion_type,
    similarity(c.name, search_term) as relevance_score
  FROM cards c
  WHERE c.name % search_term
    AND similarity(c.name, search_term) > 0.3
  
  UNION ALL
  
  -- Card types
  SELECT DISTINCT
    unnest(string_to_array(c.type_line, ' ')) as suggestion_text,
    'type' as suggestion_type,
    0.8 as relevance_score
  FROM cards c
  WHERE c.type_line ILIKE '%' || search_term || '%'
    AND LENGTH(unnest(string_to_array(c.type_line, ' '))) > 3
  
  UNION ALL
  
  -- Set names
  SELECT DISTINCT
    c.set_name as suggestion_text,
    'set' as suggestion_type,
    similarity(c.set_name, search_term) as relevance_score
  FROM cards c
  WHERE c.set_name % search_term
    AND similarity(c.set_name, search_term) > 0.4
  
  ORDER BY relevance_score DESC, suggestion_text
  LIMIT suggestion_limit;
END;
$$;


ALTER FUNCTION "public"."get_search_suggestions"("search_term" "text", "suggestion_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_search_suggestions"("search_term" "text", "suggestion_limit" integer) IS 'Returns search suggestions based on card names, types, and sets';



CREATE OR REPLACE FUNCTION "public"."get_seller_dashboard_stats"("p_seller_id" "uuid") RETURNS TABLE("active_listings" bigint, "pending_orders" bigint, "total_sales" numeric, "monthly_revenue" numeric, "avg_rating" numeric, "review_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        -- Active listings
        COUNT(l.id) FILTER (WHERE l.status = 'active'),
        -- Pending orders
        COUNT(DISTINCT o.id) FILTER (WHERE o.status IN ('pending', 'confirmed')),
        -- Total sales
        COALESCE(SUM(oi.price_at_time * oi.quantity) FILTER (WHERE o.status = 'completed'), 0),
        -- Monthly revenue (current month)
        COALESCE(SUM(oi.price_at_time * oi.quantity) FILTER (
            WHERE o.status = 'completed' 
            AND DATE_TRUNC('month', o.completed_at) = DATE_TRUNC('month', CURRENT_DATE)
        ), 0),
        -- Average rating (placeholder)
        4.8::DECIMAL(3,2),
        -- Review count (placeholder)
        45::BIGINT
    FROM listings l
    LEFT JOIN order_items oi ON l.id = oi.listing_id
    LEFT JOIN orders o ON oi.order_id = o.id
    WHERE l.seller_id = p_seller_id;
END;
$$;


ALTER FUNCTION "public"."get_seller_dashboard_stats"("p_seller_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_seller_dashboard_stats"("p_seller_id" "uuid") IS 'Returns dashboard statistics for a seller';



CREATE OR REPLACE FUNCTION "public"."get_seller_order_analytics"("p_seller_id" "uuid") RETURNS TABLE("total_orders" bigint, "pending_orders" bigint, "completed_orders" bigint, "total_revenue" numeric, "total_payout" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    WITH seller_orders AS (
        SELECT DISTINCT o.id, o.status,
               SUM(oi.price_at_time * oi.quantity) as order_total
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        JOIN listings l ON oi.listing_id = l.id
        WHERE l.seller_id = p_seller_id
        GROUP BY o.id, o.status
    )
    SELECT 
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE status IN ('pending', 'confirmed')) as pending_orders,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_orders,
        COALESCE(SUM(order_total), 0) as total_revenue,
        COALESCE(SUM(order_total * 0.975), 0) as total_payout -- After 2.5% fee
    FROM seller_orders;
END;
$$;


ALTER FUNCTION "public"."get_seller_order_analytics"("p_seller_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_seller_order_analytics"("p_seller_id" "uuid") IS 'Returns analytics data for a seller orders';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    display_name,
    role,
    approved,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'buyer'),
    CASE 
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'buyer') = 'buyer' THEN true
      ELSE false
    END,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_listing_view_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE listings 
    SET view_count = view_count + 1
    WHERE id = NEW.listing_id;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_listing_view_count"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."increment_listing_view_count"() IS 'Automatically increments view count when listing is viewed';



CREATE OR REPLACE FUNCTION "public"."increment_listing_views"("listing_uuid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE listings 
  SET views_count = views_count + 1,
      updated_at = NOW()
  WHERE id = listing_uuid;
  
  -- Also update daily analytics
  INSERT INTO listing_analytics (listing_id, date, views)
  VALUES (listing_uuid, CURRENT_DATE, 1)
  ON CONFLICT (listing_id, date)
  DO UPDATE SET views = listing_analytics.views + 1;
END;
$$;


ALTER FUNCTION "public"."increment_listing_views"("listing_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."min"("uuid", "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
    IF $2 IS NULL OR $1 > $2 THEN
        RETURN $2;
    END IF;

    RETURN $1;
END;
$_$;


ALTER FUNCTION "public"."min"("uuid", "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_order_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Send notification when order status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            created_at
        )
        SELECT 
            NEW.buyer_id,
            'order_status_change',
            'Order Status Updated',
            'Your order #' || substring(NEW.id::text, 1, 8) || ' status changed to ' || NEW.status,
            NOW()
        WHERE EXISTS (SELECT 1 FROM profiles WHERE id = NEW.buyer_id);
        
        -- Also notify seller if status changed to completed
        IF NEW.status = 'completed' THEN
            INSERT INTO notifications (
                user_id,
                type,
                title,
                message,
                created_at
            )
            SELECT DISTINCT
                l.seller_id,
                'order_completed',
                'Order Completed',
                'Order #' || substring(NEW.id::text, 1, 8) || ' has been completed. Payment will be processed.',
                NOW()
            FROM order_items oi
            JOIN listings l ON oi.listing_id = l.id
            WHERE oi.order_id = NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_order_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_price_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only record if price actually changed
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    INSERT INTO price_history (card_id, price, condition, foil, source, recorded_at)
    VALUES (NEW.card_id, NEW.price, NEW.condition, NEW.foil, 'platform', NOW());
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."record_price_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reduce_listing_quantity"("listing_id" "uuid", "p_reduce_quantity" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE listings
    SET quantity = quantity - p_reduce_quantity
    WHERE id = listing_id;
END;
$$;


ALTER FUNCTION "public"."reduce_listing_quantity"("listing_id" "uuid", "p_reduce_quantity" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_market_price_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY market_price_stats;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."refresh_market_price_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_market_price_stats_full"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW market_price_stats;
END;
$$;


ALTER FUNCTION "public"."refresh_market_price_stats_full"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_market_price_stats_view"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY market_price_stats;
END;
$$;


ALTER FUNCTION "public"."refresh_market_price_stats_view"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_cards_ranked"("search_query" "text", "result_limit" integer DEFAULT 20, "result_offset" integer DEFAULT 0) RETURNS TABLE("card_id" "uuid", "relevance_rank" real)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as card_id,
    (
      -- Name exact match gets highest score
      CASE WHEN LOWER(c.name) = LOWER(search_query) THEN 10.0
      -- Name starts with query gets high score  
      WHEN LOWER(c.name) LIKE LOWER(search_query) || '%' THEN 8.0
      -- Name contains query gets medium score
      WHEN LOWER(c.name) LIKE '%' || LOWER(search_query) || '%' THEN 6.0
      ELSE 0.0 END +
      
      -- Text search relevance (only if search_vector exists)
      CASE WHEN c.search_vector IS NOT NULL THEN
        ts_rank(c.search_vector, plainto_tsquery('english', search_query)) * 4.0
      ELSE 0.0 END +
      
      -- Trigram similarity for fuzzy matching
      similarity(c.name, search_query) * 3.0 +
      
      -- Boost popular/expensive cards slightly
      CASE WHEN c.market_price > 10 THEN 0.5 ELSE 0.0 END
    ) as relevance_rank
  FROM cards c
  WHERE 
    (c.search_vector IS NULL OR c.search_vector @@ plainto_tsquery('english', search_query))
    OR c.name % search_query
    OR LOWER(c.name) LIKE '%' || LOWER(search_query) || '%'
    OR LOWER(c.type_line) LIKE '%' || LOWER(search_query) || '%'
  ORDER BY relevance_rank DESC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$;


ALTER FUNCTION "public"."search_cards_ranked"("search_query" "text", "result_limit" integer, "result_offset" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_cards_ranked"("search_query" "text", "result_limit" integer, "result_offset" integer) IS 'Returns cards ranked by relevance for a given search query';



CREATE OR REPLACE FUNCTION "public"."set_order_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$DECLARE
  candidate text;
BEGIN
  IF NEW.order_number IS NULL THEN
    LOOP
      -- Generate an 8‑character alphanumeric string (hex digits) and ensure it does not start with '0'
      candidate := substr(md5(gen_random_uuid()::text), 1, 8);
      EXIT WHEN left(candidate, 1) <> '0' 
        AND NOT EXISTS (SELECT 1 FROM public.orders WHERE order_number = candidate);
    END LOOP;
    NEW.order_number := candidate;
  END IF;
  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."set_order_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_card_with_scryfall"("card_id_param" integer) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  card_scryfall_id UUID;
BEGIN
  -- Get the scryfall_id for the card
  SELECT scryfall_id INTO card_scryfall_id
  FROM cards 
  WHERE id = card_id_param;
  
  IF card_scryfall_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Update the scryfall_updated_at timestamp to trigger a sync
  UPDATE cards 
  SET scryfall_updated_at = NOW() - INTERVAL '1 day'
  WHERE id = card_id_param;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."sync_card_with_scryfall"("card_id_param" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_update_market_price"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Update market price for all cards in this order
    PERFORM update_market_price(l.card_id)
    FROM order_items oi
    JOIN listings l ON oi.listing_id = l.id
    WHERE oi.order_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_update_market_price"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_update_payment_analytics"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update analytics for the date the order was created
  PERFORM update_payment_analytics(DATE(NEW.created_at));
  
  -- If the order was updated (not inserted), also update the previous date if different
  IF TG_OP = 'UPDATE' AND DATE(OLD.created_at) != DATE(NEW.created_at) THEN
    PERFORM update_payment_analytics(DATE(OLD.created_at));
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_update_payment_analytics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_all_market_prices"("batch_size" integer DEFAULT 100) RETURNS TABLE("updated_count" integer, "total_processed" integer, "avg_processing_time" numeric)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  card_record RECORD;
  start_time TIMESTAMP;
  end_time TIMESTAMP;
  processing_time NUMERIC;
  total_time NUMERIC := 0;
  batch_count INTEGER := 0;
  total_updated INTEGER := 0;
  total_cards INTEGER;
  new_price NUMERIC;
BEGIN
  -- Get total count
  SELECT COUNT(*) INTO total_cards FROM cards;
  
  -- Process all cards
  FOR card_record IN
    SELECT id FROM cards ORDER BY id
  LOOP
    start_time := clock_timestamp();
    
    -- Calculate new market price for this card
    SELECT calculate_card_market_price(card_record.id) INTO new_price;
    
    -- Update the card if price changed
    UPDATE cards 
    SET 
      market_price = new_price,
      market_price_source = CASE 
        WHEN new_price != COALESCE(market_price, 0) THEN 'calculated'
        ELSE market_price_source
      END,
      market_price_updated_at = CASE
        WHEN new_price != COALESCE(market_price, 0) THEN NOW()
        ELSE market_price_updated_at
      END
    WHERE id = card_record.id
      AND (market_price IS NULL OR market_price != new_price);
    
    -- Count if we actually updated
    IF FOUND THEN
      total_updated := total_updated + 1;
    END IF;
    
    batch_count := batch_count + 1;
    
    end_time := clock_timestamp();
    processing_time := EXTRACT(MILLISECONDS FROM end_time - start_time);
    total_time := total_time + processing_time;
    
    -- Yield control periodically to avoid long-running transaction
    IF batch_count % batch_size = 0 THEN
      COMMIT;
    END IF;
  END LOOP;

  -- Return results
  updated_count := total_updated;
  total_processed := batch_count;
  avg_processing_time := CASE 
    WHEN batch_count > 0 THEN ROUND((total_time / batch_count)::NUMERIC, 3)
    ELSE 0 
  END;
  
  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."update_all_market_prices"("batch_size" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_all_market_prices"("batch_size" integer) IS 'Batch update market prices for all cards';



CREATE OR REPLACE FUNCTION "public"."update_card_search_vector"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.name, '') || ' ' ||
    COALESCE(NEW.type_line, '') || ' ' ||
    COALESCE(NEW.oracle_text, '') || ' ' ||
    COALESCE(NEW.flavor_text, '') || ' ' ||
    COALESCE(NEW.set_name, '') || ' ' ||
    COALESCE(array_to_string(NEW.keywords, ' '), '')
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_card_search_vector"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_checkout_sessions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_checkout_sessions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_listing_sales_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- Update sales count for all listings in this order
        UPDATE listings 
        SET sales_count = sales_count + oi.quantity
        FROM order_items oi
        WHERE listings.id = oi.listing_id
        AND oi.order_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_listing_sales_count"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_listing_sales_count"() IS 'Updates listing sales count when order is completed';



CREATE OR REPLACE FUNCTION "public"."update_listing_status_to_sold"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.quantity = 0 THEN
    NEW.status := 'sold';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_listing_status_to_sold"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_market_price"("card_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  avg_price DECIMAL(10,2);
  sales_count INTEGER;
BEGIN
  -- Calculate average price from recent sales (last 30 days)
  SELECT 
    AVG(oi.price), 
    COUNT(*)
  INTO avg_price, sales_count
  FROM order_items oi
  JOIN listings l ON oi.listing_id = l.id
  JOIN orders o ON oi.order_id = o.id
  WHERE l.card_id = card_id 
    AND o.status = 'completed'
    AND o.created_at >= NOW() - INTERVAL '30 days';
  
  -- Update market price if we have sales data
  IF sales_count > 0 THEN
    UPDATE cards 
    SET market_price = avg_price
    WHERE id = card_id;
    
    -- Also update price history
    INSERT INTO price_history (card_id, date, average_price, sales_count)
    VALUES (card_id, CURRENT_DATE, avg_price, sales_count)
    ON CONFLICT (card_id, date) 
    DO UPDATE SET 
      average_price = EXCLUDED.average_price,
      sales_count = EXCLUDED.sales_count;
  END IF;
END;
$$;


ALTER FUNCTION "public"."update_market_price"("card_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_market_price_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.market_price IS DISTINCT FROM NEW.market_price THEN
    NEW.market_price_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_market_price_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_market_prices"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE cards
  SET market_price = subquery.avg_price,
      updated_at = NOW()
  FROM (
    SELECT 
      l.card_id,
      ROUND(AVG(oi.price)::numeric, 2) as avg_price
    FROM order_items oi
    JOIN listings l ON oi.listing_id = l.id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status = 'completed'
      AND o.created_at >= NOW() - INTERVAL '90 days'
    GROUP BY l.card_id
    HAVING COUNT(*) >= 3  -- At least 3 sales for reliable average
  ) subquery
  WHERE cards.id = subquery.card_id;
END;
$$;


ALTER FUNCTION "public"."update_market_prices"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_payment_analytics"("target_date" "date" DEFAULT CURRENT_DATE) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  analytics_data RECORD;
BEGIN
  -- Calculate daily payment statistics
  SELECT 
    COUNT(*) as total_transactions,
    COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN total_amount ELSE 0 END), 0) as total_amount,
    COUNT(CASE WHEN payment_status = 'completed' THEN 1 END) as successful_transactions,
    COUNT(CASE WHEN payment_status = 'failed' THEN 1 END) as failed_transactions,
    COUNT(CASE WHEN refund_status = 'completed' THEN 1 END) as total_refunds,
    COALESCE(SUM(CASE WHEN refund_status = 'completed' THEN refund_amount ELSE 0 END), 0) as refund_amount
  INTO analytics_data
  FROM orders 
  WHERE DATE(created_at) = target_date;

  -- Insert or update analytics record
  INSERT INTO payment_analytics (
    date, 
    total_transactions, 
    total_amount, 
    successful_transactions, 
    failed_transactions,
    total_refunds,
    refund_amount,
    platform_fees
  ) VALUES (
    target_date,
    analytics_data.total_transactions,
    analytics_data.total_amount,
    analytics_data.successful_transactions,
    analytics_data.failed_transactions,
    analytics_data.total_refunds,
    analytics_data.refund_amount,
    analytics_data.total_amount * 0.025 -- 2.5% platform fee
  )
  ON CONFLICT (date) 
  DO UPDATE SET
    total_transactions = EXCLUDED.total_transactions,
    total_amount = EXCLUDED.total_amount,
    successful_transactions = EXCLUDED.successful_transactions,
    failed_transactions = EXCLUDED.failed_transactions,
    total_refunds = EXCLUDED.total_refunds,
    refund_amount = EXCLUDED.refund_amount,
    platform_fees = EXCLUDED.platform_fees;
END;
$$;


ALTER FUNCTION "public"."update_payment_analytics"("target_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_seller_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE profiles 
  SET rating = (
    SELECT ROUND(AVG(rating)::numeric, 1)
    FROM seller_reviews 
    WHERE seller_id = NEW.seller_id
  )
  WHERE id = NEW.seller_id;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_seller_rating"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE AGGREGATE "public"."min"("uuid") (
    SFUNC = "public"."min",
    STYPE = "uuid"
);


ALTER AGGREGATE "public"."min"("uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "action_type" character varying(50) NOT NULL,
    "target_user_id" "uuid",
    "target_resource_id" "uuid",
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auth_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action" character varying(50) NOT NULL,
    "ip_address" "inet",
    "user_agent" "text",
    "success" boolean DEFAULT true,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."auth_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "set_number" "text" NOT NULL,
    "card_number" "text",
    "mana_cost" "text",
    "rarity" "text" NOT NULL,
    "treatment" "text",
    "image_url" "text",
    "type_line" "text",
    "market_price" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "price_updated_at" timestamp with time zone,
    "scryfall_id" "uuid",
    "cmc" integer DEFAULT 0,
    "oracle_text" "text",
    "power" character varying(10),
    "toughness" character varying(10),
    "loyalty" character varying(10),
    "image_url_small" "text",
    "image_url_large" "text",
    "prices" "jsonb" DEFAULT '{}'::"jsonb",
    "set_name" "text",
    "set_type" "text",
    "released_at" "date",
    "artist" "text",
    "border_color" "text",
    "frame" "text",
    "security_stamp" "text",
    "layout" "text",
    "multiverse_ids" integer[],
    "mtgo_id" integer,
    "arena_id" integer,
    "tcgplayer_id" integer,
    "cardmarket_id" integer,
    "lang" character varying(5) DEFAULT 'en'::character varying,
    "digital" boolean DEFAULT false,
    "foil" boolean DEFAULT false,
    "nonfoil" boolean DEFAULT true,
    "oversized" boolean DEFAULT false,
    "promo" boolean DEFAULT false,
    "reprint" boolean DEFAULT false,
    "variation" boolean DEFAULT false,
    "keywords" "text"[],
    "card_faces" "jsonb",
    "scryfall_updated_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "frame_effects" "text",
    "promo_types" "text",
    "colors" "text"[],
    "color_identity" "text"[],
    "flavor_text" "text",
    "legalities" "jsonb",
    "search_vector" "tsvector",
    "market_price_updated_at" timestamp with time zone DEFAULT "now"(),
    "market_price_source" "text" DEFAULT 'manual'::"text",
    "last_sales_count" integer DEFAULT 0,
    "weight_grams" numeric(8,2) DEFAULT 1.8,
    "oracle_id" "uuid",
    CONSTRAINT "cards_rarity_check" CHECK (("rarity" = ANY (ARRAY['common'::"text", 'uncommon'::"text", 'rare'::"text", 'mythic'::"text"]))),
    CONSTRAINT "check_layout" CHECK (("layout" = ANY (ARRAY['normal'::"text", 'split'::"text", 'flip'::"text", 'transform'::"text", 'modal_dfc'::"text", 'meld'::"text", 'leveler'::"text", 'saga'::"text", 'adventure'::"text", 'planar'::"text", 'scheme'::"text", 'vanguard'::"text", 'token'::"text", 'double_faced_token'::"text", 'emblem'::"text", 'augment'::"text", 'host'::"text"]))),
    CONSTRAINT "check_rarity" CHECK (("rarity" = ANY (ARRAY['common'::"text", 'uncommon'::"text", 'rare'::"text", 'mythic'::"text", 'special'::"text", 'bonus'::"text"])))
);


ALTER TABLE "public"."cards" OWNER TO "postgres";


COMMENT ON TABLE "public"."cards" IS 'Master card profiles with calculated market prices';



COMMENT ON COLUMN "public"."cards"."market_price" IS 'Calculated market price based on recent sales or current listings';



COMMENT ON COLUMN "public"."cards"."scryfall_id" IS 'Unique identifier from Scryfall API for syncing card data';



COMMENT ON COLUMN "public"."cards"."prices" IS 'JSON object containing price data from Scryfall (usd, usd_foil, eur, tix)';



COMMENT ON COLUMN "public"."cards"."market_price_updated_at" IS 'When the market price was last calculated';



COMMENT ON COLUMN "public"."cards"."market_price_source" IS 'Source of market price: sales_average, current_listings, external_scryfall, etc.';



COMMENT ON COLUMN "public"."cards"."last_sales_count" IS 'Number of sales used in last market price calculation';



COMMENT ON COLUMN "public"."cards"."weight_grams" IS 'Standard weight for this card type in grams';



COMMENT ON COLUMN "public"."cards"."oracle_id" IS 'Scryfall Oracle ID - groups together different versions/printings of the same card';



CREATE TABLE IF NOT EXISTS "public"."listings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "card_id" "uuid" NOT NULL,
    "seller_id" "uuid" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "condition" "text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "language" character varying(20) DEFAULT 'English'::character varying,
    "foil" boolean DEFAULT false,
    "signed" boolean DEFAULT false,
    "altered" boolean DEFAULT false,
    "images" "text"[],
    "views_count" integer DEFAULT 0,
    "favorited_count" integer DEFAULT 0,
    "deleted_at" timestamp with time zone,
    "static_shipping_fee" numeric(10,2) DEFAULT NULL::numeric,
    "shipping_method" character varying(20) DEFAULT 'dynamic'::character varying,
    "weight_grams" numeric(8,2) DEFAULT 1.8,
    "view_count" integer DEFAULT 0,
    "sales_count" integer DEFAULT 0,
    "watchlist_count" integer DEFAULT 0,
    CONSTRAINT "listings_condition_check" CHECK (("condition" = ANY (ARRAY['near_mint'::"text", 'lightly_played'::"text", 'moderately_played'::"text", 'heavily_played'::"text", 'damaged'::"text"]))),
    CONSTRAINT "listings_shipping_method_check" CHECK ((("shipping_method")::"text" = ANY ((ARRAY['static'::character varying, 'dynamic'::character varying])::"text"[]))),
    CONSTRAINT "listings_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'sold'::"text", 'removed'::"text"])))
);


ALTER TABLE "public"."listings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."listings"."static_shipping_fee" IS 'Fixed shipping fee set by seller (NULL means use dynamic calculation)';



COMMENT ON COLUMN "public"."listings"."shipping_method" IS 'Shipping calculation method: static (fixed fee) or dynamic (EasyPost)';



COMMENT ON COLUMN "public"."listings"."weight_grams" IS 'Individual item weight in grams';



CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tracking_number" character varying(255),
    "shipping_status" character varying(50) DEFAULT 'pending'::character varying,
    CONSTRAINT "order_items_shipping_status_check" CHECK ((("shipping_status")::"text" = ANY ((ARRAY['pending'::character varying, 'label_created'::character varying, 'shipped'::character varying, 'in_transit'::character varying, 'delivered'::character varying, 'failed'::character varying])::"text"[])))
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."order_items"."tracking_number" IS 'Shipping carrier tracking number';



COMMENT ON COLUMN "public"."order_items"."shipping_status" IS 'Current shipping status of this item';



CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buyer_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "subtotal" numeric(10,2) NOT NULL,
    "shipping_cost" numeric(10,2) NOT NULL,
    "tax_amount" numeric(10,2) NOT NULL,
    "total_amount" numeric(10,2) NOT NULL,
    "shipping_address" "jsonb" NOT NULL,
    "tracking_number" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "payment_intent_id" character varying(255),
    "payment_status" character varying(20) DEFAULT 'pending'::character varying,
    "helcim_transaction_id" character varying(255),
    "paid_at" timestamp with time zone,
    "refund_status" character varying(20) DEFAULT 'none'::character varying,
    "refund_amount" numeric(10,2),
    "refund_reason" "text",
    "refunded_at" timestamp with time zone,
    "refund_initiated_at" timestamp with time zone,
    "payout_processed" boolean DEFAULT false,
    "payout_id" "uuid",
    "payment_failure_reason" "text",
    "completed_at" timestamp with time zone,
    "billing_address" "jsonb",
    "currency" "text",
    "notes" "text",
    "requires_manual_review" boolean DEFAULT false,
    "order_number" "text",
    "shipped_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "label_url" "text",
    "label_tracking_code" "text",
    CONSTRAINT "orders_payment_status_check" CHECK ((("payment_status")::"text" = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'refunded'::character varying])::"text"[]))),
    CONSTRAINT "orders_refund_status_check" CHECK ((("refund_status")::"text" = ANY ((ARRAY['none'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying])::"text"[]))),
    CONSTRAINT "orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'shipped'::"text", 'delivered'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."orders"."completed_at" IS 'Timestamp when order was completed';



COMMENT ON COLUMN "public"."orders"."notes" IS 'Admin notes for orders requiring manual review';



COMMENT ON COLUMN "public"."orders"."requires_manual_review" IS 'Flag for orders that need admin attention';



COMMENT ON COLUMN "public"."orders"."shipped_at" IS 'Timestamp when order was marked as shipped';



COMMENT ON COLUMN "public"."orders"."delivered_at" IS 'Timestamp when order was marked as delivered';



COMMENT ON COLUMN "public"."orders"."label_url" IS 'URL to the generated shipping label';



CREATE OR REPLACE VIEW "public"."cards_needing_price_updates" WITH ("security_invoker"='on') AS
 SELECT "c"."id",
    "c"."name",
    "c"."market_price",
    "c"."market_price_updated_at",
    "c"."market_price_source",
    COALESCE("recent_sales"."sales_count", (0)::bigint) AS "recent_sales",
    COALESCE("active_listings"."listings_count", (0)::bigint) AS "active_listings"
   FROM (("public"."cards" "c"
     LEFT JOIN ( SELECT "l"."card_id",
            "count"(*) AS "sales_count"
           FROM (("public"."order_items" "oi"
             JOIN "public"."orders" "o" ON (("oi"."order_id" = "o"."id")))
             JOIN "public"."listings" "l" ON (("oi"."listing_id" = "l"."id")))
          WHERE (("o"."status" = 'completed'::"text") AND ("o"."completed_at" >= ("now"() - '30 days'::interval)))
          GROUP BY "l"."card_id") "recent_sales" ON (("c"."id" = "recent_sales"."card_id")))
     LEFT JOIN ( SELECT "listings"."card_id",
            "count"(*) AS "listings_count"
           FROM "public"."listings"
          WHERE (("listings"."status" = 'active'::"text") AND ("listings"."quantity" > 0))
          GROUP BY "listings"."card_id") "active_listings" ON (("c"."id" = "active_listings"."card_id")))
  WHERE (("c"."market_price_updated_at" < ("now"() - '7 days'::interval)) OR ("c"."market_price_source" = ANY (ARRAY['rarity_default'::"text", 'minimum_fallback'::"text"])))
  ORDER BY "c"."market_price_updated_at";


ALTER VIEW "public"."cards_needing_price_updates" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."cards_search_view" WITH ("security_invoker"='on') AS
 SELECT "c"."id",
    "c"."name",
    "c"."set_number",
    "c"."set_name",
    "c"."card_number",
    "c"."mana_cost",
    "c"."cmc",
    "c"."type_line",
    "c"."oracle_text",
    "c"."power",
    "c"."toughness",
    "c"."loyalty",
    "c"."rarity",
    "c"."treatment",
    "c"."image_url",
    "c"."image_url_small",
    "c"."market_price",
    "c"."released_at",
    "c"."artist",
    "c"."layout",
    "c"."foil",
    "c"."nonfoil",
    "c"."digital",
    "c"."promo",
    "c"."keywords",
    "count"("l"."id") AS "listing_count",
    "min"("l"."price") AS "lowest_price",
    "avg"("l"."price") AS "average_price",
    "count"(
        CASE
            WHEN (("o"."created_at" > ("now"() - '30 days'::interval)) AND ("o"."status" = 'completed'::"text")) THEN 1
            ELSE NULL::integer
        END) AS "recent_sales",
    ("c"."prices" ->> 'usd'::"text") AS "scryfall_price_usd",
    ("c"."prices" ->> 'usd_foil'::"text") AS "scryfall_price_usd_foil"
   FROM ((("public"."cards" "c"
     LEFT JOIN "public"."listings" "l" ON ((("c"."id" = "l"."card_id") AND ("l"."status" = 'active'::"text"))))
     LEFT JOIN "public"."order_items" "oi" ON (("l"."id" = "oi"."listing_id")))
     LEFT JOIN "public"."orders" "o" ON (("oi"."order_id" = "o"."id")))
  GROUP BY "c"."id", "c"."name", "c"."set_number", "c"."set_name", "c"."card_number", "c"."mana_cost", "c"."cmc", "c"."type_line", "c"."oracle_text", "c"."power", "c"."toughness", "c"."loyalty", "c"."rarity", "c"."treatment", "c"."image_url", "c"."image_url_small", "c"."market_price", "c"."released_at", "c"."artist", "c"."layout", "c"."foil", "c"."nonfoil", "c"."digital", "c"."promo", "c"."keywords", "c"."prices";


ALTER VIEW "public"."cards_search_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cart_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."cart_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checkout_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "checkout_token" character varying(255) NOT NULL,
    "user_id" "uuid" NOT NULL,
    "order_reference" character varying(255) NOT NULL,
    "order_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "currency" character varying(3) DEFAULT 'CAD'::character varying NOT NULL,
    "status" character varying(50) DEFAULT 'initialized'::character varying,
    "session_data" "jsonb" NOT NULL,
    "error_message" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "checkout_sessions_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['initialized'::character varying, 'completed'::character varying, 'failed'::character varying, 'expired'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."checkout_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."checkout_sessions" IS 'HelcimPay.js checkout sessions with token management and expiration';



COMMENT ON COLUMN "public"."checkout_sessions"."checkout_token" IS 'Unique token from HelcimPay.js initialize API';



COMMENT ON COLUMN "public"."checkout_sessions"."order_reference" IS 'Unique reference for this checkout attempt';



COMMENT ON COLUMN "public"."checkout_sessions"."status" IS 'Current status of the checkout session';



COMMENT ON COLUMN "public"."checkout_sessions"."session_data" IS 'Complete session data including items, addresses, and secret token';



COMMENT ON COLUMN "public"."checkout_sessions"."expires_at" IS 'When this checkout session expires (60 minutes from creation)';



CREATE TABLE IF NOT EXISTS "public"."critical_payment_errors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" character varying(100) NOT NULL,
    "transaction_id" character varying(255) NOT NULL,
    "user_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "currency" character varying(3) DEFAULT 'CAD'::character varying,
    "payment_intent_id" character varying(255),
    "error_details" "jsonb",
    "status" character varying(50) DEFAULT 'needs_manual_review'::character varying,
    "resolution_method" character varying(100),
    "resolution_notes" "text",
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "critical_payment_errors_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['needs_manual_review'::character varying, 'auto_refunded'::character varying, 'manually_resolved'::character varying, 'resolved'::character varying, 'escalated'::character varying])::"text"[])))
);


ALTER TABLE "public"."critical_payment_errors" OWNER TO "postgres";


COMMENT ON TABLE "public"."critical_payment_errors" IS 'Tracks critical payment errors that require manual intervention';



CREATE TABLE IF NOT EXISTS "public"."customer_payment_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "helcim_customer_id" character varying(255),
    "method_type" character varying(20) NOT NULL,
    "card_last_four" character varying(4),
    "card_brand" character varying(20),
    "card_exp_month" integer,
    "card_exp_year" integer,
    "bank_name" character varying(100),
    "account_last_four" character varying(4),
    "account_type" character varying(20),
    "is_default" boolean DEFAULT false,
    "is_verified" boolean DEFAULT false,
    "nickname" character varying(50),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "customer_payment_methods_method_type_check" CHECK ((("method_type")::"text" = ANY ((ARRAY['card'::character varying, 'bank_account'::character varying])::"text"[])))
);


ALTER TABLE "public"."customer_payment_methods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."price_history" (
    "id" integer NOT NULL,
    "card_id" "uuid",
    "condition" character varying(20) DEFAULT 'near_mint'::character varying NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "source" character varying(20) DEFAULT 'platform'::character varying,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "volume" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "price_source" "text" DEFAULT 'manual'::"text"
);


ALTER TABLE "public"."price_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."price_history" IS 'Daily snapshots of market prices for trend analysis';



COMMENT ON COLUMN "public"."price_history"."price_source" IS 'Source of the price data for this snapshot';



CREATE OR REPLACE VIEW "public"."daily_price_changes" WITH ("security_invoker"='on') AS
 SELECT "c"."id",
    "c"."name",
    "c"."set_number",
    "today"."price" AS "current_price",
    "yesterday"."price" AS "yesterday_price",
        CASE
            WHEN ("yesterday"."price" > (0)::numeric) THEN "round"(((("today"."price" - "yesterday"."price") / "yesterday"."price") * (100)::numeric), 2)
            ELSE NULL::numeric
        END AS "percent_change"
   FROM (("public"."cards" "c"
     JOIN LATERAL ( SELECT "price_history"."price"
           FROM "public"."price_history"
          WHERE (("price_history"."card_id" = "c"."id") AND ("price_history"."date" = CURRENT_DATE))
          ORDER BY "price_history"."date" DESC
         LIMIT 1) "today" ON (true))
     LEFT JOIN LATERAL ( SELECT "price_history"."price"
           FROM "public"."price_history"
          WHERE (("price_history"."card_id" = "c"."id") AND ("price_history"."date" = (CURRENT_DATE - 1)))
          ORDER BY "price_history"."date" DESC
         LIMIT 1) "yesterday" ON (true));


ALTER VIEW "public"."daily_price_changes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deleted_accounts_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "deleted_at" timestamp with time zone DEFAULT "now"(),
    "deletion_method" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."deleted_accounts_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fraud_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "order_id" "uuid",
    "payment_intent_id" "uuid",
    "alert_type" character varying(50) NOT NULL,
    "severity" character varying(20) DEFAULT 'medium'::character varying,
    "description" "text" NOT NULL,
    "risk_score" integer,
    "rules_triggered" "text"[],
    "detection_data" "jsonb",
    "status" character varying(20) DEFAULT 'open'::character varying,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "resolution_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "fraud_alerts_severity_check" CHECK ((("severity")::"text" = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::"text"[]))),
    CONSTRAINT "fraud_alerts_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['open'::character varying, 'investigating'::character varying, 'resolved'::character varying, 'false_positive'::character varying])::"text"[])))
);


ALTER TABLE "public"."fraud_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."helcim_transaction_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_type" character varying(50) NOT NULL,
    "status" character varying(20) NOT NULL,
    "transaction_data" "jsonb" NOT NULL,
    "helcim_transaction_id" character varying(255),
    "checkout_token" character varying(255),
    "user_id" "uuid",
    "order_id" "uuid",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "helcim_transaction_logs_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['success'::character varying, 'error'::character varying, 'pending'::character varying, 'failed'::character varying])::"text"[]))),
    CONSTRAINT "helcim_transaction_logs_transaction_type_check" CHECK ((("transaction_type")::"text" = ANY ((ARRAY['initialization'::character varying, 'payment'::character varying, 'refund'::character varying, 'webhook'::character varying, 'validation'::character varying])::"text"[])))
);


ALTER TABLE "public"."helcim_transaction_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."helcim_transaction_logs" IS 'Audit trail for all Helcim API interactions';



COMMENT ON COLUMN "public"."helcim_transaction_logs"."transaction_type" IS 'Type of Helcim operation (initialization, payment, etc.)';



COMMENT ON COLUMN "public"."helcim_transaction_logs"."transaction_data" IS 'Complete transaction data from Helcim API';



CREATE TABLE IF NOT EXISTS "public"."listing_analytics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "views" integer DEFAULT 0,
    "favorites" integer DEFAULT 0,
    "cart_adds" integer DEFAULT 0,
    "purchases" integer DEFAULT 0
);


ALTER TABLE "public"."listing_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."listing_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."listing_views" OWNER TO "postgres";


COMMENT ON TABLE "public"."listing_views" IS 'Tracks listing page views for analytics';



CREATE OR REPLACE VIEW "public"."market_price_analytics" WITH ("security_invoker"='on') AS
 SELECT "c"."id",
    "c"."name",
    "c"."set_number",
    "c"."market_price",
    "c"."market_price_updated_at",
    "c"."market_price_source",
    "c"."last_sales_count",
    COALESCE("recent_sales"."sales_30d", (0)::bigint) AS "sales_last_30_days",
    COALESCE("recent_sales"."avg_price_30d", "c"."market_price") AS "avg_sale_price_30d",
    COALESCE("current_listings"."active_listings", (0)::bigint) AS "active_listings_count",
    COALESCE("current_listings"."lowest_listing", "c"."market_price") AS "lowest_current_listing",
    COALESCE("current_listings"."avg_listing", "c"."market_price") AS "avg_current_listing",
        CASE
            WHEN (("prev_price"."price" IS NOT NULL) AND ("prev_price"."price" > (0)::numeric)) THEN "round"(((("c"."market_price" - "prev_price"."price") / "prev_price"."price") * (100)::numeric), 2)
            ELSE NULL::numeric
        END AS "price_change_30d_percent"
   FROM ((("public"."cards" "c"
     LEFT JOIN ( SELECT "l"."card_id",
            "count"(*) AS "sales_30d",
            "avg"("oi"."price") AS "avg_price_30d"
           FROM (("public"."order_items" "oi"
             JOIN "public"."orders" "o" ON (("oi"."order_id" = "o"."id")))
             JOIN "public"."listings" "l" ON (("oi"."listing_id" = "l"."id")))
          WHERE (("o"."status" = 'completed'::"text") AND ("o"."completed_at" >= ("now"() - '30 days'::interval)))
          GROUP BY "l"."card_id") "recent_sales" ON (("c"."id" = "recent_sales"."card_id")))
     LEFT JOIN ( SELECT "listings"."card_id",
            "count"(*) AS "active_listings",
            "min"("listings"."price") AS "lowest_listing",
            "avg"("listings"."price") AS "avg_listing"
           FROM "public"."listings"
          WHERE (("listings"."status" = 'active'::"text") AND ("listings"."quantity" > 0))
          GROUP BY "listings"."card_id") "current_listings" ON (("c"."id" = "current_listings"."card_id")))
     LEFT JOIN ( SELECT DISTINCT ON ("price_history"."card_id") "price_history"."card_id",
            "price_history"."price"
           FROM "public"."price_history"
          WHERE ("price_history"."date" <= ("now"() - '30 days'::interval))
          ORDER BY "price_history"."card_id", "price_history"."date" DESC) "prev_price" ON (("c"."id" = "prev_price"."card_id")));


ALTER VIEW "public"."market_price_analytics" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."market_price_stats" AS
 SELECT "count"(*) FILTER (WHERE ("cards"."market_price" IS NOT NULL)) AS "total_cards_with_prices",
    "count"(DISTINCT "cards"."id") AS "total_unique_cards",
    "round"("avg"("cards"."market_price"), 2) AS "average_market_price",
    "round"("min"("cards"."market_price"), 2) AS "lowest_price",
    "round"("max"("cards"."market_price"), 2) AS "highest_price",
    "round"(("percentile_cont"((0.5)::double precision) WITHIN GROUP (ORDER BY (("cards"."market_price")::double precision)))::numeric, 2) AS "median_price",
    "jsonb_object_agg"(COALESCE("cards"."market_price_source", 'unknown'::"text"), "source_counts"."count_by_source") FILTER (WHERE ("cards"."market_price" IS NOT NULL)) AS "price_source_breakdown",
    "count"(*) FILTER (WHERE ("cards"."market_price_updated_at" >= ("now"() - '24:00:00'::interval))) AS "recently_updated_count",
    "count"(*) FILTER (WHERE ("cards"."market_price_updated_at" >= ("now"() - '7 days'::interval))) AS "updated_last_week",
    "count"(*) FILTER (WHERE ("cards"."market_price_source" = 'sales_average'::"text")) AS "high_confidence_prices",
    "count"(*) FILTER (WHERE ("cards"."market_price_source" = ANY (ARRAY['sales_average'::"text", 'current_listings'::"text", 'calculated'::"text"]))) AS "good_confidence_prices",
    "round"("sum"("cards"."market_price"), 2) AS "total_market_value",
    "now"() AS "last_refreshed_at"
   FROM ("public"."cards"
     LEFT JOIN LATERAL ( SELECT "cards_1"."market_price_source",
            "count"(*) AS "count_by_source"
           FROM "public"."cards" "cards_1"
          WHERE ("cards_1"."market_price" IS NOT NULL)
          GROUP BY "cards_1"."market_price_source") "source_counts" ON (true))
  WHERE ("cards"."market_price" IS NOT NULL)
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."market_price_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" character varying(50) NOT NULL,
    "title" character varying(255) NOT NULL,
    "message" "text" NOT NULL,
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_item_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_item_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_size" integer,
    "mime_type" character varying(100),
    "uploaded_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."order_item_photos" OWNER TO "postgres";


COMMENT ON TABLE "public"."order_item_photos" IS 'Photos of individual items before shipping to document condition';



CREATE TABLE IF NOT EXISTS "public"."order_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "is_internal" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."order_notes" OWNER TO "postgres";


COMMENT ON TABLE "public"."order_notes" IS 'Internal notes for orders, visible to sellers and buyers';



CREATE TABLE IF NOT EXISTS "public"."payment_analytics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "total_transactions" integer DEFAULT 0,
    "total_amount" numeric(12,2) DEFAULT 0.00,
    "successful_transactions" integer DEFAULT 0,
    "failed_transactions" integer DEFAULT 0,
    "total_refunds" integer DEFAULT 0,
    "refund_amount" numeric(12,2) DEFAULT 0.00,
    "total_payouts" integer DEFAULT 0,
    "payout_amount" numeric(12,2) DEFAULT 0.00,
    "platform_fees" numeric(10,2) DEFAULT 0.00,
    "processing_fees" numeric(10,2) DEFAULT 0.00,
    "currency_breakdown" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payment_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_intents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "helcim_transaction_id" character varying(255),
    "checkout_token" character varying(500),
    "amount" numeric(10,2) NOT NULL,
    "currency" character varying(3) DEFAULT 'CAD'::character varying,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "customer_details" "jsonb",
    "billing_address" "jsonb",
    "shipping_address" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payment_intents_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."payment_intents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_type" character varying(50) NOT NULL,
    "helcim_transaction_id" character varying(255),
    "amount" numeric(10,2),
    "currency" character varying(3) DEFAULT 'CAD'::character varying,
    "status" character varying(50),
    "raw_data" "jsonb",
    "metadata" "jsonb",
    "error_code" character varying(50),
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payment_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payout_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "frequency" character varying(20) NOT NULL,
    "day_of_week" integer,
    "day_of_month" integer,
    "cron_expression" character varying(100),
    "minimum_threshold" numeric(10,2) DEFAULT 25.00,
    "maximum_amount" numeric(12,2),
    "is_active" boolean DEFAULT true,
    "last_run_at" timestamp with time zone,
    "next_run_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payout_schedules_frequency_check" CHECK ((("frequency")::"text" = ANY ((ARRAY['daily'::character varying, 'weekly'::character varying, 'monthly'::character varying, 'custom'::character varying])::"text"[])))
);


ALTER TABLE "public"."payout_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payout_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "seller_id" "uuid" NOT NULL,
    "payment_method" "text" NOT NULL,
    "payment_details" "jsonb" NOT NULL,
    "minimum_payout" numeric(10,2) DEFAULT 25.00,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payout_settings_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['paypal'::"text", 'bank_transfer'::"text", 'stripe'::"text"])))
);


ALTER TABLE "public"."payout_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."platform_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."price_alert_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "card_id" "uuid" NOT NULL,
    "alert_price" numeric(10,2) NOT NULL,
    "current_price" numeric(10,2) NOT NULL,
    "triggered_at" timestamp with time zone DEFAULT "now"(),
    "email_sent" boolean DEFAULT false,
    "email_sent_at" timestamp with time zone
);


ALTER TABLE "public"."price_alert_notifications" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."price_history_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."price_history_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."price_history_id_seq" OWNED BY "public"."price_history"."id";



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "display_name" "text",
    "role" "text" DEFAULT 'buyer'::"text",
    "approved" boolean DEFAULT false,
    "rating" numeric(3,2) DEFAULT 0,
    "total_sales" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "email_preferences" "jsonb" DEFAULT '{"security": true, "marketing": false, "price_alerts": true, "order_updates": true}'::"jsonb",
    "business_info" "jsonb" DEFAULT '{}'::"jsonb",
    "phone" "text",
    "timezone" "text",
    "bio" "text",
    "shipping_address" "jsonb",
    "seller_application_status" character varying(20) DEFAULT 'not_applied'::character varying,
    "seller_tier" character varying(20) DEFAULT 'standard'::character varying,
    "suspended" boolean DEFAULT false,
    "suspended_until" timestamp with time zone,
    "suspension_reason" "text",
    "last_active_at" timestamp with time zone DEFAULT "now"(),
    "shipping_preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "default_shipping_method" character varying(20) DEFAULT 'dynamic'::character varying,
    "business_name" character varying(255),
    "website" "text",
    "payout_settings" "jsonb" DEFAULT '{}'::"jsonb",
    "notification_preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "seller_notes" "text",
    CONSTRAINT "profiles_default_shipping_method_check" CHECK ((("default_shipping_method")::"text" = ANY ((ARRAY['static'::character varying, 'dynamic'::character varying])::"text"[]))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['buyer'::"text", 'seller'::"text", 'admin'::"text"]))),
    CONSTRAINT "profiles_seller_application_status_check" CHECK ((("seller_application_status")::"text" = ANY ((ARRAY['not_applied'::character varying, 'pending'::character varying, 'info_requested'::character varying, 'approved'::character varying, 'rejected'::character varying])::"text"[]))),
    CONSTRAINT "profiles_seller_tier_check" CHECK ((("seller_tier")::"text" = ANY ((ARRAY['standard'::character varying, 'premium'::character varying, 'enterprise'::character varying])::"text"[])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."shipping_preferences" IS 'JSON object containing seller shipping preferences';



COMMENT ON COLUMN "public"."profiles"."default_shipping_method" IS 'Default shipping method for new listings';



CREATE TABLE IF NOT EXISTS "public"."refund_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "reason" "text",
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "admin_notes" "text",
    "processed_by" "uuid",
    "processed_at" timestamp with time zone,
    "helcim_refund_id" character varying(255),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "refund_requests_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'processed'::character varying, 'rejected'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."refund_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."refund_requests" IS 'Customer refund requests that require admin processing';



COMMENT ON COLUMN "public"."refund_requests"."helcim_refund_id" IS 'Helcim refund transaction ID after processing';



CREATE TABLE IF NOT EXISTS "public"."saved_searches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" character varying(100) NOT NULL,
    "query_params" "jsonb" NOT NULL,
    "alert_enabled" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."saved_searches" OWNER TO "postgres";


COMMENT ON TABLE "public"."saved_searches" IS 'Stores user saved searches with optional price alerts';



CREATE TABLE IF NOT EXISTS "public"."scryfall_import_jobs" (
    "id" integer NOT NULL,
    "job_type" character varying(50) NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "target_identifier" "text",
    "total_items" integer DEFAULT 0,
    "processed_items" integer DEFAULT 0,
    "imported_items" integer DEFAULT 0,
    "error_items" integer DEFAULT 0,
    "error_message" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scryfall_import_jobs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."scryfall_import_jobs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."scryfall_import_jobs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."scryfall_import_jobs_id_seq" OWNED BY "public"."scryfall_import_jobs"."id";



CREATE OR REPLACE VIEW "public"."searchable_listings" WITH ("security_invoker"='on') AS
 SELECT "l"."id",
    "l"."card_id",
    "l"."seller_id",
    "l"."price",
    "l"."condition",
    "l"."quantity",
    "l"."status",
    "l"."foil",
    "l"."signed",
    "l"."altered",
    "l"."language",
    "l"."created_at",
    "l"."updated_at",
    "c"."name" AS "card_name",
    "c"."set_number",
    "c"."card_number",
    "c"."set_name",
    "c"."mana_cost",
    "c"."rarity",
    "c"."treatment",
    "c"."image_url",
    "c"."type_line",
    "c"."market_price",
    "p"."display_name" AS "seller_name",
    "p"."rating" AS "seller_rating",
    "p"."seller_tier",
    "p"."shipping_address" AS "seller_location",
    "lower"("c"."name") AS "name_search",
    "lower"("c"."type_line") AS "type_search",
    "lower"("c"."set_name") AS "set_search",
        CASE
            WHEN (("l"."quantity" > 0) AND ("l"."status" = 'active'::"text")) THEN "l"."price"
            ELSE NULL::numeric
        END AS "available_price",
        CASE "l"."condition"
            WHEN 'Near Mint'::"text" THEN 1
            WHEN 'Lightly Played'::"text" THEN 2
            WHEN 'Moderately Played'::"text" THEN 3
            WHEN 'Heavily Played'::"text" THEN 4
            WHEN 'Damaged'::"text" THEN 5
            ELSE 6
        END AS "condition_rank",
    "to_tsvector"('"english"'::"regconfig", (((((("c"."name" || ' '::"text") || COALESCE("c"."type_line", ''::"text")) || ' '::"text") || COALESCE("c"."set_name", ''::"text")) || ' '::"text") || COALESCE("c"."rarity", ''::"text"))) AS "search_vector"
   FROM (("public"."listings" "l"
     JOIN "public"."cards" "c" ON (("l"."card_id" = "c"."id")))
     JOIN "public"."profiles" "p" ON (("l"."seller_id" = "p"."id")))
  WHERE (("l"."status" = 'active'::"text") AND ("p"."role" = 'seller'::"text") AND ("p"."approved" = true) AND ("l"."quantity" > 0));


ALTER VIEW "public"."searchable_listings" OWNER TO "postgres";


COMMENT ON VIEW "public"."searchable_listings" IS 'Optimized view for searching active card listings with card details and seller information. Includes search optimization fields and proper filtering for active, approved sellers only.';



CREATE TABLE IF NOT EXISTS "public"."security_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "details" "jsonb",
    "ip_address" "inet",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."security_logs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."seller_analytics" WITH ("security_invoker"='on') AS
 SELECT "p"."id" AS "seller_id",
    "p"."display_name",
    "count"(DISTINCT "l"."id") AS "total_listings",
    "count"(DISTINCT "l"."id") FILTER (WHERE ("l"."status" = 'active'::"text")) AS "active_listings",
    "count"(DISTINCT "o"."id") AS "total_orders",
    "count"(DISTINCT "o"."id") FILTER (WHERE ("o"."status" = 'completed'::"text")) AS "completed_orders",
    COALESCE("sum"(("oi"."price" * ("oi"."quantity")::numeric)) FILTER (WHERE ("o"."status" = 'completed'::"text")), (0)::numeric) AS "total_revenue",
    COALESCE("avg"(("oi"."price" * ("oi"."quantity")::numeric)) FILTER (WHERE ("o"."status" = 'completed'::"text")), (0)::numeric) AS "avg_order_value",
    COALESCE("sum"("l"."view_count"), (0)::bigint) AS "total_views",
    COALESCE("sum"("l"."sales_count"), (0)::bigint) AS "total_items_sold"
   FROM ((("public"."profiles" "p"
     LEFT JOIN "public"."listings" "l" ON (("p"."id" = "l"."seller_id")))
     LEFT JOIN "public"."order_items" "oi" ON (("l"."id" = "oi"."listing_id")))
     LEFT JOIN "public"."orders" "o" ON (("oi"."order_id" = "o"."id")))
  WHERE ("p"."role" = 'seller'::"text")
  GROUP BY "p"."id", "p"."display_name";


ALTER VIEW "public"."seller_analytics" OWNER TO "postgres";


COMMENT ON VIEW "public"."seller_analytics" IS 'Comprehensive seller performance metrics';



CREATE TABLE IF NOT EXISTS "public"."seller_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "business_name" character varying(255) NOT NULL,
    "business_type" character varying(50) NOT NULL,
    "tax_id" character varying(100),
    "address" "jsonb" NOT NULL,
    "phone" character varying(20) NOT NULL,
    "description" "text",
    "experience_years" integer DEFAULT 0,
    "references" "text"[],
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "reviewed_by" "uuid",
    "approved_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "info_requested_at" timestamp with time zone,
    "approved_by" "uuid",
    "rejected_by" "uuid",
    "info_requested_by" "uuid",
    "admin_notes" "text",
    "admin_message" "text",
    "rejection_reason" "text",
    "required_documents" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "seller_applications_business_type_check" CHECK ((("business_type")::"text" = ANY ((ARRAY['individual'::character varying, 'business'::character varying, 'corporation'::character varying])::"text"[]))),
    CONSTRAINT "seller_applications_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'info_requested'::character varying, 'approved'::character varying, 'rejected'::character varying])::"text"[])))
);


ALTER TABLE "public"."seller_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seller_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "application_id" "uuid",
    "document_type" character varying(50) NOT NULL,
    "file_name" character varying(255) NOT NULL,
    "file_path" character varying(500) NOT NULL,
    "file_size" integer,
    "mime_type" character varying(100),
    "uploaded_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."seller_documents" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."seller_order_summary" WITH ("security_invoker"='on') AS
 SELECT "o"."id" AS "order_id",
    "o"."status",
    "o"."total_amount",
    "o"."shipping_cost",
    "o"."tax_amount",
    "o"."created_at",
    "o"."shipped_at",
    "o"."delivered_at",
    "o"."completed_at",
    "o"."tracking_number",
    "o"."label_url",
    "buyer"."id" AS "buyer_id",
    "buyer"."display_name" AS "buyer_name",
    "buyer"."email" AS "buyer_email",
    "o"."shipping_address",
    "count"("oi"."id") AS "item_count",
    "l"."seller_id",
    "sum"(("oi"."price" * ("oi"."quantity")::numeric)) AS "seller_subtotal"
   FROM ((("public"."orders" "o"
     JOIN "public"."order_items" "oi" ON (("o"."id" = "oi"."order_id")))
     JOIN "public"."listings" "l" ON (("oi"."listing_id" = "l"."id")))
     JOIN "public"."profiles" "buyer" ON (("o"."buyer_id" = "buyer"."id")))
  GROUP BY "o"."id", "o"."status", "o"."total_amount", "o"."shipping_cost", "o"."tax_amount", "o"."created_at", "o"."shipped_at", "o"."delivered_at", "o"."completed_at", "o"."tracking_number", "o"."label_url", "buyer"."id", "buyer"."display_name", "buyer"."email", "o"."shipping_address", "l"."seller_id";


ALTER VIEW "public"."seller_order_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seller_payouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "seller_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "fee_amount" numeric(10,2) NOT NULL,
    "net_amount" numeric(10,2) NOT NULL,
    "payout_method" character varying(50) NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "external_payout_id" character varying(255),
    "external_reference" character varying(255),
    "order_ids" "uuid"[],
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "initiated_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "retry_count" integer DEFAULT 0,
    "failure_reason" "text",
    "processing_fee" numeric(8,2) DEFAULT 0.00,
    "exchange_rate" numeric(10,6),
    "notes" "text",
    CONSTRAINT "seller_payouts_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying])::"text"[])))
);


ALTER TABLE "public"."seller_payouts" OWNER TO "postgres";


COMMENT ON TABLE "public"."seller_payouts" IS 'Tracks seller payments and platform fees';



CREATE TABLE IF NOT EXISTS "public"."seller_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "seller_id" "uuid" NOT NULL,
    "reviewer_id" "uuid",
    "order_id" "uuid",
    "rating" integer NOT NULL,
    "comment" "text",
    "communication_rating" integer,
    "shipping_speed_rating" integer,
    "item_condition_rating" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "seller_reviews_communication_rating_check" CHECK ((("communication_rating" >= 1) AND ("communication_rating" <= 5))),
    CONSTRAINT "seller_reviews_item_condition_rating_check" CHECK ((("item_condition_rating" >= 1) AND ("item_condition_rating" <= 5))),
    CONSTRAINT "seller_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "seller_reviews_shipping_speed_rating_check" CHECK ((("shipping_speed_rating" >= 1) AND ("shipping_speed_rating" <= 5)))
);


ALTER TABLE "public"."seller_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seller_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "business_name" character varying(255),
    "business_type" character varying(50),
    "tax_id" character varying(100),
    "payout_method" character varying(50) DEFAULT 'bank_transfer'::character varying,
    "payout_threshold" numeric(10,2) DEFAULT 25.00,
    "auto_payout" boolean DEFAULT false,
    "bank_details" "jsonb",
    "paypal_email" character varying(255),
    "default_shipping_cost" numeric(8,2) DEFAULT 0.00,
    "free_shipping_threshold" numeric(10,2),
    "handling_time_days" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "seller_settings_payout_method_check" CHECK ((("payout_method")::"text" = ANY ((ARRAY['bank_transfer'::character varying, 'paypal'::character varying, 'stripe'::character varying])::"text"[])))
);


ALTER TABLE "public"."seller_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shared_wishlists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "wishlist_data" "jsonb" NOT NULL,
    "include_price_alerts" boolean DEFAULT false,
    "expires_at" timestamp with time zone NOT NULL,
    "view_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shared_wishlists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" character varying(100) NOT NULL,
    "value" "jsonb" NOT NULL,
    "description" "text",
    "category" character varying(50) DEFAULT 'general'::character varying,
    "is_public" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wishlist_activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "card_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "timestamp" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "wishlist_activity_log_action_check" CHECK (("action" = ANY (ARRAY['added'::"text", 'removed'::"text", 'updated'::"text", 'cleared'::"text", 'imported'::"text", 'exported'::"text", 'shared'::"text"])))
);


ALTER TABLE "public"."wishlist_activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wishlists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "card_id" "uuid" NOT NULL,
    "max_price" numeric(10,2),
    "condition_preference" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text",
    "updated_at" "date"
);


ALTER TABLE "public"."wishlists" OWNER TO "postgres";


ALTER TABLE ONLY "public"."price_history" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."price_history_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."scryfall_import_jobs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."scryfall_import_jobs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."admin_actions"
    ADD CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_logs"
    ADD CONSTRAINT "auth_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checkout_sessions"
    ADD CONSTRAINT "checkout_sessions_checkout_token_key" UNIQUE ("checkout_token");



ALTER TABLE ONLY "public"."checkout_sessions"
    ADD CONSTRAINT "checkout_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."critical_payment_errors"
    ADD CONSTRAINT "critical_payment_errors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."critical_payment_errors"
    ADD CONSTRAINT "critical_payment_errors_transaction_id_key" UNIQUE ("transaction_id");



ALTER TABLE ONLY "public"."customer_payment_methods"
    ADD CONSTRAINT "customer_payment_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deleted_accounts_log"
    ADD CONSTRAINT "deleted_accounts_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fraud_alerts"
    ADD CONSTRAINT "fraud_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."helcim_transaction_logs"
    ADD CONSTRAINT "helcim_transaction_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."listing_analytics"
    ADD CONSTRAINT "listing_analytics_listing_id_date_key" UNIQUE ("listing_id", "date");



ALTER TABLE ONLY "public"."listing_analytics"
    ADD CONSTRAINT "listing_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."listing_views"
    ADD CONSTRAINT "listing_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_item_photos"
    ADD CONSTRAINT "order_item_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_notes"
    ADD CONSTRAINT "order_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_analytics"
    ADD CONSTRAINT "payment_analytics_date_key" UNIQUE ("date");



ALTER TABLE ONLY "public"."payment_analytics"
    ADD CONSTRAINT "payment_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_intents"
    ADD CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_logs"
    ADD CONSTRAINT "payment_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payout_schedules"
    ADD CONSTRAINT "payout_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payout_settings"
    ADD CONSTRAINT "payout_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payout_settings"
    ADD CONSTRAINT "payout_settings_seller_id_key" UNIQUE ("seller_id");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."price_alert_notifications"
    ADD CONSTRAINT "price_alert_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."price_history"
    ADD CONSTRAINT "price_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_searches"
    ADD CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scryfall_import_jobs"
    ADD CONSTRAINT "scryfall_import_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_logs"
    ADD CONSTRAINT "security_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seller_applications"
    ADD CONSTRAINT "seller_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seller_documents"
    ADD CONSTRAINT "seller_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seller_payouts"
    ADD CONSTRAINT "seller_payouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seller_reviews"
    ADD CONSTRAINT "seller_reviews_order_id_reviewer_id_key" UNIQUE ("order_id", "reviewer_id");



ALTER TABLE ONLY "public"."seller_reviews"
    ADD CONSTRAINT "seller_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seller_settings"
    ADD CONSTRAINT "seller_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seller_settings"
    ADD CONSTRAINT "seller_settings_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."shared_wishlists"
    ADD CONSTRAINT "shared_wishlists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wishlist_activity_log"
    ADD CONSTRAINT "wishlist_activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wishlists"
    ADD CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wishlists"
    ADD CONSTRAINT "wishlists_user_id_card_id_key" UNIQUE ("user_id", "card_id");



CREATE INDEX "idx_admin_actions_admin_id" ON "public"."admin_actions" USING "btree" ("admin_id");



CREATE INDEX "idx_admin_actions_target_user" ON "public"."admin_actions" USING "btree" ("target_user_id");



CREATE INDEX "idx_admin_actions_type_date" ON "public"."admin_actions" USING "btree" ("action_type", "created_at" DESC);



CREATE INDEX "idx_cards_cmc" ON "public"."cards" USING "btree" ("cmc") WHERE ("cmc" IS NOT NULL);



CREATE INDEX "idx_cards_color_identity" ON "public"."cards" USING "gin" ("color_identity") WHERE ("color_identity" IS NOT NULL);



CREATE INDEX "idx_cards_colors" ON "public"."cards" USING "gin" ("colors") WHERE ("colors" IS NOT NULL);



CREATE INDEX "idx_cards_digital" ON "public"."cards" USING "btree" ("digital");



CREATE INDEX "idx_cards_keywords" ON "public"."cards" USING "gin" ("keywords") WHERE ("keywords" IS NOT NULL);



CREATE INDEX "idx_cards_layout" ON "public"."cards" USING "btree" ("layout");



CREATE INDEX "idx_cards_legalities" ON "public"."cards" USING "gin" ("legalities") WHERE ("legalities" IS NOT NULL);



CREATE INDEX "idx_cards_market_price_stats" ON "public"."cards" USING "btree" ("market_price", "market_price_source", "market_price_updated_at") WHERE ("market_price" IS NOT NULL);



CREATE INDEX "idx_cards_market_price_updated" ON "public"."cards" USING "btree" ("market_price_updated_at" DESC);



CREATE INDEX "idx_cards_name_gin" ON "public"."cards" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_cards_name_set" ON "public"."cards" USING "btree" ("name", "set_number");



CREATE INDEX "idx_cards_name_trgm" ON "public"."cards" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_cards_oracle_id" ON "public"."cards" USING "btree" ("oracle_id");



CREATE INDEX "idx_cards_oracle_text_gin" ON "public"."cards" USING "gin" ("oracle_text" "public"."gin_trgm_ops");



CREATE INDEX "idx_cards_prices_gin" ON "public"."cards" USING "gin" ("prices");



CREATE INDEX "idx_cards_rarity" ON "public"."cards" USING "btree" ("rarity");



CREATE INDEX "idx_cards_rarity_cmc" ON "public"."cards" USING "btree" ("rarity", "cmc") WHERE ("cmc" IS NOT NULL);



CREATE INDEX "idx_cards_released_at" ON "public"."cards" USING "btree" ("released_at");



CREATE INDEX "idx_cards_scryfall_id" ON "public"."cards" USING "btree" ("scryfall_id");



CREATE INDEX "idx_cards_search_vector" ON "public"."cards" USING "gin" ("search_vector") WHERE ("search_vector" IS NOT NULL);



CREATE INDEX "idx_cards_set_name_gin" ON "public"."cards" USING "gin" ("set_name" "public"."gin_trgm_ops");



CREATE INDEX "idx_cards_set_number" ON "public"."cards" USING "btree" ("set_number");



CREATE INDEX "idx_cards_type_line_gin" ON "public"."cards" USING "gin" ("type_line" "public"."gin_trgm_ops");



CREATE INDEX "idx_cards_type_line_trgm" ON "public"."cards" USING "gin" ("type_line" "public"."gin_trgm_ops");



CREATE INDEX "idx_cart_items_user" ON "public"."cart_items" USING "btree" ("user_id");



CREATE INDEX "idx_checkout_sessions_created" ON "public"."checkout_sessions" USING "btree" ("created_at");



CREATE INDEX "idx_checkout_sessions_expires" ON "public"."checkout_sessions" USING "btree" ("expires_at");



CREATE INDEX "idx_checkout_sessions_order_ref" ON "public"."checkout_sessions" USING "btree" ("order_reference");



CREATE INDEX "idx_checkout_sessions_status" ON "public"."checkout_sessions" USING "btree" ("status");



CREATE INDEX "idx_checkout_sessions_token" ON "public"."checkout_sessions" USING "btree" ("checkout_token");



CREATE INDEX "idx_checkout_sessions_user" ON "public"."checkout_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_critical_errors_status" ON "public"."critical_payment_errors" USING "btree" ("status");



CREATE INDEX "idx_critical_errors_transaction" ON "public"."critical_payment_errors" USING "btree" ("transaction_id");



CREATE INDEX "idx_critical_errors_user" ON "public"."critical_payment_errors" USING "btree" ("user_id");



CREATE INDEX "idx_customer_payment_methods_default" ON "public"."customer_payment_methods" USING "btree" ("user_id", "is_default");



CREATE INDEX "idx_customer_payment_methods_helcim_id" ON "public"."customer_payment_methods" USING "btree" ("helcim_customer_id");



CREATE INDEX "idx_customer_payment_methods_user_id" ON "public"."customer_payment_methods" USING "btree" ("user_id");



CREATE INDEX "idx_fraud_alerts_severity" ON "public"."fraud_alerts" USING "btree" ("severity");



CREATE INDEX "idx_fraud_alerts_status" ON "public"."fraud_alerts" USING "btree" ("status");



CREATE INDEX "idx_fraud_alerts_type_date" ON "public"."fraud_alerts" USING "btree" ("alert_type", "created_at" DESC);



CREATE INDEX "idx_fraud_alerts_user_id" ON "public"."fraud_alerts" USING "btree" ("user_id");



CREATE INDEX "idx_helcim_logs_checkout_token" ON "public"."helcim_transaction_logs" USING "btree" ("checkout_token");



CREATE INDEX "idx_helcim_logs_created" ON "public"."helcim_transaction_logs" USING "btree" ("created_at");



CREATE INDEX "idx_helcim_logs_status" ON "public"."helcim_transaction_logs" USING "btree" ("status");



CREATE INDEX "idx_helcim_logs_transaction_id" ON "public"."helcim_transaction_logs" USING "btree" ("helcim_transaction_id");



CREATE INDEX "idx_helcim_logs_type" ON "public"."helcim_transaction_logs" USING "btree" ("transaction_type");



CREATE INDEX "idx_helcim_logs_user" ON "public"."helcim_transaction_logs" USING "btree" ("user_id");



CREATE INDEX "idx_listing_views_created_at" ON "public"."listing_views" USING "btree" ("created_at");



CREATE INDEX "idx_listing_views_listing_id" ON "public"."listing_views" USING "btree" ("listing_id");



CREATE INDEX "idx_listings_active_by_card" ON "public"."listings" USING "btree" ("card_id", "price") WHERE (("status" = 'active'::"text") AND ("quantity" > 0));



CREATE INDEX "idx_listings_active_join" ON "public"."listings" USING "btree" ("card_id", "seller_id", "status") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_listings_altered" ON "public"."listings" USING "btree" ("altered");



CREATE INDEX "idx_listings_card_condition" ON "public"."listings" USING "btree" ("card_id", "condition");



CREATE INDEX "idx_listings_card_id_status" ON "public"."listings" USING "btree" ("card_id", "status");



CREATE INDEX "idx_listings_card_price_status" ON "public"."listings" USING "btree" ("card_id", "price", "status");



CREATE INDEX "idx_listings_card_status" ON "public"."listings" USING "btree" ("card_id", "status");



CREATE INDEX "idx_listings_condition" ON "public"."listings" USING "btree" ("condition");



CREATE INDEX "idx_listings_created_at" ON "public"."listings" USING "btree" ("created_at");



CREATE INDEX "idx_listings_foil" ON "public"."listings" USING "btree" ("foil") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_listings_language" ON "public"."listings" USING "btree" ("language");



CREATE INDEX "idx_listings_price" ON "public"."listings" USING "btree" ("price");



CREATE INDEX "idx_listings_price_condition" ON "public"."listings" USING "btree" ("price", "condition");



CREATE INDEX "idx_listings_price_range" ON "public"."listings" USING "btree" ("price") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_listings_quantity" ON "public"."listings" USING "btree" ("quantity");



CREATE INDEX "idx_listings_seller_id" ON "public"."listings" USING "btree" ("seller_id");



CREATE INDEX "idx_listings_seller_id_status" ON "public"."listings" USING "btree" ("seller_id", "status");



CREATE INDEX "idx_listings_seller_status" ON "public"."listings" USING "btree" ("seller_id", "status");



CREATE INDEX "idx_listings_shipping" ON "public"."listings" USING "btree" ("seller_id", "shipping_method");



CREATE INDEX "idx_listings_signed" ON "public"."listings" USING "btree" ("signed");



CREATE INDEX "idx_listings_status" ON "public"."listings" USING "btree" ("status");



CREATE INDEX "idx_notifications_created_at" ON "public"."notifications" USING "btree" ("created_at");



CREATE INDEX "idx_notifications_read" ON "public"."notifications" USING "btree" ("read");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_order_item_photos_order_id" ON "public"."order_item_photos" USING "btree" ("order_id");



CREATE INDEX "idx_order_item_photos_order_item_id" ON "public"."order_item_photos" USING "btree" ("order_item_id");



CREATE INDEX "idx_order_item_photos_uploaded_by" ON "public"."order_item_photos" USING "btree" ("uploaded_by");



CREATE INDEX "idx_order_items_listing_id" ON "public"."order_items" USING "btree" ("listing_id");



CREATE INDEX "idx_order_items_shipping_status" ON "public"."order_items" USING "btree" ("shipping_status");



CREATE INDEX "idx_order_items_tracking" ON "public"."order_items" USING "btree" ("tracking_number");



CREATE INDEX "idx_order_notes_created_at" ON "public"."order_notes" USING "btree" ("created_at");



CREATE INDEX "idx_order_notes_order_id" ON "public"."order_notes" USING "btree" ("order_id");



CREATE INDEX "idx_order_notes_user_id" ON "public"."order_notes" USING "btree" ("user_id");



CREATE INDEX "idx_orders_buyer_created" ON "public"."orders" USING "btree" ("buyer_id", "created_at" DESC);



CREATE INDEX "idx_orders_completed_at" ON "public"."orders" USING "btree" ("completed_at" DESC) WHERE ("completed_at" IS NOT NULL);



CREATE INDEX "idx_orders_created_at" ON "public"."orders" USING "btree" ("created_at");



CREATE INDEX "idx_orders_helcim_transaction" ON "public"."orders" USING "btree" ("helcim_transaction_id");



CREATE INDEX "idx_orders_paid_at" ON "public"."orders" USING "btree" ("paid_at");



CREATE INDEX "idx_orders_payment_status" ON "public"."orders" USING "btree" ("payment_status");



CREATE INDEX "idx_orders_payout_processed" ON "public"."orders" USING "btree" ("payout_processed");



CREATE INDEX "idx_orders_seller_items" ON "public"."order_items" USING "btree" ("order_id");



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "idx_payment_analytics_date" ON "public"."payment_analytics" USING "btree" ("date" DESC);



CREATE INDEX "idx_payment_intents_helcim_id" ON "public"."payment_intents" USING "btree" ("helcim_transaction_id");



CREATE INDEX "idx_payment_intents_order_id" ON "public"."payment_intents" USING "btree" ("order_id");



CREATE INDEX "idx_payment_intents_status" ON "public"."payment_intents" USING "btree" ("status");



CREATE INDEX "idx_payment_logs_created_at" ON "public"."payment_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_payment_logs_helcim_id" ON "public"."payment_logs" USING "btree" ("helcim_transaction_id");



CREATE INDEX "idx_payment_logs_transaction_type" ON "public"."payment_logs" USING "btree" ("transaction_type");



CREATE INDEX "idx_price_alerts_user_pending" ON "public"."price_alert_notifications" USING "btree" ("user_id", "email_sent");



CREATE INDEX "idx_price_history_card_date" ON "public"."price_history" USING "btree" ("card_id", "date");



CREATE INDEX "idx_price_history_condition" ON "public"."price_history" USING "btree" ("condition");



CREATE INDEX "idx_price_history_date" ON "public"."price_history" USING "btree" ("date" DESC);



CREATE INDEX "idx_price_history_source" ON "public"."price_history" USING "btree" ("source");



CREATE INDEX "idx_profiles_approved" ON "public"."profiles" USING "btree" ("approved");



CREATE INDEX "idx_profiles_display_name_trgm" ON "public"."profiles" USING "gin" ("display_name" "public"."gin_trgm_ops");



CREATE INDEX "idx_profiles_email_preferences" ON "public"."profiles" USING "gin" ("email_preferences");



CREATE INDEX "idx_profiles_rating" ON "public"."profiles" USING "btree" ("rating") WHERE ("rating" IS NOT NULL);



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_profiles_role_approved" ON "public"."profiles" USING "btree" ("role", "approved");



CREATE INDEX "idx_profiles_seller_tier" ON "public"."profiles" USING "btree" ("seller_tier") WHERE ("seller_tier" IS NOT NULL);



CREATE INDEX "idx_refund_requests_created" ON "public"."refund_requests" USING "btree" ("created_at");



CREATE INDEX "idx_refund_requests_order" ON "public"."refund_requests" USING "btree" ("order_id");



CREATE INDEX "idx_refund_requests_status" ON "public"."refund_requests" USING "btree" ("status");



CREATE INDEX "idx_refund_requests_user" ON "public"."refund_requests" USING "btree" ("user_id");



CREATE INDEX "idx_saved_searches_created_at" ON "public"."saved_searches" USING "btree" ("created_at");



CREATE INDEX "idx_saved_searches_user_id" ON "public"."saved_searches" USING "btree" ("user_id");



CREATE INDEX "idx_security_logs_action" ON "public"."security_logs" USING "btree" ("action");



CREATE INDEX "idx_security_logs_ip" ON "public"."security_logs" USING "btree" ("ip_address");



CREATE INDEX "idx_security_logs_timestamp" ON "public"."security_logs" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_security_logs_user_action" ON "public"."security_logs" USING "btree" ("user_id", "action");



CREATE INDEX "idx_security_logs_user_action_time" ON "public"."security_logs" USING "btree" ("user_id", "action", "timestamp" DESC);



CREATE INDEX "idx_security_logs_user_id" ON "public"."security_logs" USING "btree" ("user_id");



CREATE INDEX "idx_seller_applications_status" ON "public"."seller_applications" USING "btree" ("status");



CREATE INDEX "idx_seller_applications_submitted_at" ON "public"."seller_applications" USING "btree" ("submitted_at" DESC);



CREATE INDEX "idx_seller_applications_user_id" ON "public"."seller_applications" USING "btree" ("user_id");



CREATE INDEX "idx_seller_documents_application_id" ON "public"."seller_documents" USING "btree" ("application_id");



CREATE INDEX "idx_seller_documents_user_id" ON "public"."seller_documents" USING "btree" ("user_id");



CREATE INDEX "idx_seller_payouts_created_at" ON "public"."seller_payouts" USING "btree" ("created_at");



CREATE INDEX "idx_seller_payouts_external_id" ON "public"."seller_payouts" USING "btree" ("external_payout_id");



CREATE INDEX "idx_seller_payouts_period" ON "public"."seller_payouts" USING "btree" ("period_start", "period_end");



CREATE INDEX "idx_seller_payouts_seller_id" ON "public"."seller_payouts" USING "btree" ("seller_id");



CREATE INDEX "idx_seller_payouts_seller_status" ON "public"."seller_payouts" USING "btree" ("seller_id", "status");



CREATE INDEX "idx_seller_payouts_status" ON "public"."seller_payouts" USING "btree" ("status");



CREATE INDEX "idx_seller_reviews_rating" ON "public"."seller_reviews" USING "btree" ("seller_id", "rating");



CREATE INDEX "idx_seller_reviews_seller_id" ON "public"."seller_reviews" USING "btree" ("seller_id");



CREATE INDEX "idx_shared_wishlists_expires" ON "public"."shared_wishlists" USING "btree" ("expires_at");



CREATE INDEX "idx_shared_wishlists_user" ON "public"."shared_wishlists" USING "btree" ("user_id");



CREATE INDEX "idx_system_settings_category" ON "public"."system_settings" USING "btree" ("category");



CREATE INDEX "idx_system_settings_key" ON "public"."system_settings" USING "btree" ("key");



CREATE INDEX "idx_wishlist_activity_action" ON "public"."wishlist_activity_log" USING "btree" ("action");



CREATE INDEX "idx_wishlist_activity_user_time" ON "public"."wishlist_activity_log" USING "btree" ("user_id", "timestamp" DESC);



CREATE UNIQUE INDEX "market_price_stats_unique_idx" ON "public"."market_price_stats" USING "btree" ("last_refreshed_at");



CREATE OR REPLACE TRIGGER "assign_oracle_id_trigger" BEFORE INSERT ON "public"."cards" FOR EACH ROW EXECUTE FUNCTION "public"."assign_oracle_id"();



CREATE OR REPLACE TRIGGER "listing_view_counter" AFTER INSERT ON "public"."listing_views" FOR EACH ROW EXECUTE FUNCTION "public"."increment_listing_view_count"();



CREATE OR REPLACE TRIGGER "order_completion_sales_counter" AFTER UPDATE OF "status" ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_listing_sales_count"();



CREATE OR REPLACE TRIGGER "order_status_change_notification" AFTER UPDATE OF "status" ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."notify_order_status_change"();



CREATE OR REPLACE TRIGGER "set_order_number_trigger" AFTER INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_order_number"();



CREATE OR REPLACE TRIGGER "set_status_sold_on_quantity_zero" BEFORE UPDATE OF "quantity" ON "public"."listings" FOR EACH ROW WHEN (("new"."quantity" = 0)) EXECUTE FUNCTION "public"."update_listing_status_to_sold"();



CREATE OR REPLACE TRIGGER "trigger_add_price_history" AFTER UPDATE ON "public"."cards" FOR EACH ROW WHEN (("old"."market_price" IS DISTINCT FROM "new"."market_price")) EXECUTE FUNCTION "public"."add_price_history_on_change"();



CREATE OR REPLACE TRIGGER "trigger_check_price_alerts" AFTER UPDATE ON "public"."cards" FOR EACH ROW EXECUTE FUNCTION "public"."check_price_alerts_on_update"();



CREATE OR REPLACE TRIGGER "trigger_checkout_sessions_updated_at" BEFORE UPDATE ON "public"."checkout_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_checkout_sessions_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_payment_analytics_update" AFTER INSERT OR UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_payment_analytics"();



CREATE OR REPLACE TRIGGER "trigger_record_price_change" AFTER UPDATE ON "public"."listings" FOR EACH ROW EXECUTE FUNCTION "public"."record_price_change"();



CREATE OR REPLACE TRIGGER "trigger_refresh_market_price_stats" AFTER INSERT OR UPDATE OF "market_price", "market_price_source", "market_price_updated_at" ON "public"."cards" FOR EACH STATEMENT EXECUTE FUNCTION "public"."refresh_market_price_stats"();



CREATE OR REPLACE TRIGGER "trigger_update_market_price_timestamp" BEFORE UPDATE ON "public"."cards" FOR EACH ROW EXECUTE FUNCTION "public"."update_market_price_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_update_seller_applications_updated_at" BEFORE UPDATE ON "public"."seller_applications" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_update_seller_rating" AFTER INSERT OR DELETE OR UPDATE ON "public"."seller_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_seller_rating"();



CREATE OR REPLACE TRIGGER "trigger_update_seller_reviews_updated_at" BEFORE UPDATE ON "public"."seller_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_update_seller_settings_updated_at" BEFORE UPDATE ON "public"."seller_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_update_system_settings_updated_at" BEFORE UPDATE ON "public"."system_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_card_search_vector_trigger" BEFORE INSERT OR UPDATE ON "public"."cards" FOR EACH ROW EXECUTE FUNCTION "public"."update_card_search_vector"();



CREATE OR REPLACE TRIGGER "update_market_price_trigger" AFTER UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_market_price"();



CREATE OR REPLACE TRIGGER "update_order_notes_updated_at" BEFORE UPDATE ON "public"."order_notes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."admin_actions"
    ADD CONSTRAINT "admin_actions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_actions"
    ADD CONSTRAINT "admin_actions_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."auth_logs"
    ADD CONSTRAINT "auth_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id");



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."checkout_sessions"
    ADD CONSTRAINT "checkout_sessions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."checkout_sessions"
    ADD CONSTRAINT "checkout_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."critical_payment_errors"
    ADD CONSTRAINT "critical_payment_errors_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."critical_payment_errors"
    ADD CONSTRAINT "critical_payment_errors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."customer_payment_methods"
    ADD CONSTRAINT "customer_payment_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fraud_alerts"
    ADD CONSTRAINT "fraud_alerts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fraud_alerts"
    ADD CONSTRAINT "fraud_alerts_payment_intent_id_fkey" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fraud_alerts"
    ADD CONSTRAINT "fraud_alerts_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."fraud_alerts"
    ADD CONSTRAINT "fraud_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."helcim_transaction_logs"
    ADD CONSTRAINT "helcim_transaction_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."helcim_transaction_logs"
    ADD CONSTRAINT "helcim_transaction_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."listing_analytics"
    ADD CONSTRAINT "listing_analytics_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listing_views"
    ADD CONSTRAINT "listing_views_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listing_views"
    ADD CONSTRAINT "listing_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id");



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_item_photos"
    ADD CONSTRAINT "order_item_photos_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_item_photos"
    ADD CONSTRAINT "order_item_photos_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_item_photos"
    ADD CONSTRAINT "order_item_photos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."order_notes"
    ADD CONSTRAINT "order_notes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_notes"
    ADD CONSTRAINT "order_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "public"."seller_payouts"("id");



ALTER TABLE ONLY "public"."payment_intents"
    ADD CONSTRAINT "payment_intents_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payout_settings"
    ADD CONSTRAINT "payout_settings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."price_alert_notifications"
    ADD CONSTRAINT "price_alert_notifications_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id");



ALTER TABLE ONLY "public"."price_alert_notifications"
    ADD CONSTRAINT "price_alert_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."price_history"
    ADD CONSTRAINT "price_history_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."saved_searches"
    ADD CONSTRAINT "saved_searches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scryfall_import_jobs"
    ADD CONSTRAINT "scryfall_import_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."security_logs"
    ADD CONSTRAINT "security_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seller_applications"
    ADD CONSTRAINT "seller_applications_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."seller_applications"
    ADD CONSTRAINT "seller_applications_info_requested_by_fkey" FOREIGN KEY ("info_requested_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."seller_applications"
    ADD CONSTRAINT "seller_applications_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."seller_applications"
    ADD CONSTRAINT "seller_applications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."seller_applications"
    ADD CONSTRAINT "seller_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seller_documents"
    ADD CONSTRAINT "seller_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."seller_applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seller_documents"
    ADD CONSTRAINT "seller_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seller_payouts"
    ADD CONSTRAINT "seller_payouts_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seller_reviews"
    ADD CONSTRAINT "seller_reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seller_reviews"
    ADD CONSTRAINT "seller_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."seller_reviews"
    ADD CONSTRAINT "seller_reviews_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seller_settings"
    ADD CONSTRAINT "seller_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shared_wishlists"
    ADD CONSTRAINT "shared_wishlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."wishlist_activity_log"
    ADD CONSTRAINT "wishlist_activity_log_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id");



ALTER TABLE ONLY "public"."wishlist_activity_log"
    ADD CONSTRAINT "wishlist_activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."wishlists"
    ADD CONSTRAINT "wishlists_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id");



ALTER TABLE ONLY "public"."wishlists"
    ADD CONSTRAINT "wishlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



CREATE POLICY "Admins can insert cards" ON "public"."cards" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage admin actions" ON "public"."admin_actions" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage all checkout sessions" ON "public"."checkout_sessions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage all payouts" ON "public"."seller_payouts" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage critical errors" ON "public"."critical_payment_errors" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage fraud alerts" ON "public"."fraud_alerts" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage payout schedules" ON "public"."payout_schedules" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage refund requests" ON "public"."refund_requests" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage system settings" ON "public"."system_settings" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can update cards" ON "public"."cards" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view all applications" ON "public"."seller_applications" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view all documents" ON "public"."seller_documents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view all payment intents" ON "public"."payment_intents" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view all payouts" ON "public"."seller_payouts" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view all transaction logs" ON "public"."helcim_transaction_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view cards" ON "public"."cards" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view critical errors" ON "public"."critical_payment_errors" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view payment analytics" ON "public"."payment_analytics" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view payment logs" ON "public"."payment_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view security logs" ON "public"."security_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view seller settings" ON "public"."seller_settings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Allow admins to update market prices" ON "public"."cards" FOR UPDATE USING (((("auth"."jwt"() ->> 'role'::"text") = 'admin'::"text") OR (("auth"."jwt"() ->> 'user_role'::"text") = 'admin'::"text")));



CREATE POLICY "Allow authenticated users to read market prices" ON "public"."cards" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow service role to update market prices" ON "public"."cards" FOR UPDATE USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Anyone can insert listing views" ON "public"."listing_views" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can read reviews" ON "public"."seller_reviews" FOR SELECT USING (true);



CREATE POLICY "Anyone can view active listings" ON "public"."listings" FOR SELECT USING (("status" = 'active'::"text"));



CREATE POLICY "Buyers can create reviews for their orders" ON "public"."seller_reviews" FOR INSERT WITH CHECK ((("auth"."uid"() = "reviewer_id") AND (EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."id" = "seller_reviews"."order_id") AND ("orders"."buyer_id" = "auth"."uid"()) AND ("orders"."status" = 'delivered'::"text"))))));



CREATE POLICY "Cards are viewable by everyone" ON "public"."cards" FOR SELECT USING (true);



CREATE POLICY "Enable delete for users based on user_id" ON "public"."cart_items" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Enable insert for authenticated users only" ON "public"."cart_items" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."order_items" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."price_history" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."wishlists" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for users based on user_id" ON "public"."orders" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "buyer_id"));



CREATE POLICY "Enable read access for all users" ON "public"."cards" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."cart_items" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."order_items" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."price_history" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."wishlists" FOR SELECT USING (true);



CREATE POLICY "Enable users to view their own data only" ON "public"."orders" FOR SELECT USING (( SELECT ("auth"."uid"() = "orders"."buyer_id")));



CREATE POLICY "Import jobs manageable by admin" ON "public"."scryfall_import_jobs" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Import jobs viewable by admin" ON "public"."scryfall_import_jobs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Public can view seller profiles" ON "public"."profiles" FOR SELECT USING ((("role" = 'seller'::"text") OR ("role" = 'admin'::"text")));



CREATE POLICY "Public settings can be read by anyone" ON "public"."system_settings" FOR SELECT USING (("is_public" = true));



CREATE POLICY "Sellers and buyers can create notes for their orders" ON "public"."order_notes" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM (("public"."orders" "o"
     JOIN "public"."order_items" "oi" ON (("o"."id" = "oi"."order_id")))
     JOIN "public"."listings" "l" ON (("oi"."listing_id" = "l"."id")))
  WHERE (("o"."id" = "order_notes"."order_id") AND (("l"."seller_id" = "auth"."uid"()) OR ("o"."buyer_id" = "auth"."uid"())))))));



CREATE POLICY "Sellers can manage their own listings" ON "public"."listings" USING (("auth"."uid"() = "seller_id"));



CREATE POLICY "Sellers can manage their own settings" ON "public"."seller_settings" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Sellers can manage their payout settings" ON "public"."payout_settings" USING (("auth"."uid"() = "seller_id"));



CREATE POLICY "Sellers can update order status" ON "public"."orders" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."order_items" "oi"
     JOIN "public"."listings" "l" ON (("oi"."listing_id" = "l"."id")))
  WHERE (("oi"."order_id" = "orders"."id") AND ("l"."seller_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."order_items" "oi"
     JOIN "public"."listings" "l" ON (("oi"."listing_id" = "l"."id")))
  WHERE (("oi"."order_id" = "orders"."id") AND ("l"."seller_id" = "auth"."uid"())))));



CREATE POLICY "Sellers can upload photos for their items" ON "public"."order_item_photos" FOR INSERT WITH CHECK ((("uploaded_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."order_items" "oi"
     JOIN "public"."listings" "l" ON (("oi"."listing_id" = "l"."id")))
  WHERE (("oi"."id" = "order_item_photos"."order_item_id") AND ("l"."seller_id" = "auth"."uid"()))))));



CREATE POLICY "Sellers can view their listing analytics" ON "public"."listing_views" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."listings"
  WHERE (("listings"."id" = "listing_views"."listing_id") AND ("listings"."seller_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))));



CREATE POLICY "Sellers can view their own payouts" ON "public"."seller_payouts" FOR SELECT USING (("auth"."uid"() = "seller_id"));



CREATE POLICY "System can create notifications" ON "public"."notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can insert transaction logs" ON "public"."helcim_transaction_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can create own checkout sessions" ON "public"."checkout_sessions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own refund requests" ON "public"."refund_requests" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."id" = "refund_requests"."order_id") AND ("orders"."buyer_id" = "auth"."uid"()))))));



CREATE POLICY "Users can create their own applications" ON "public"."seller_applications" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own uploaded photos" ON "public"."order_item_photos" FOR DELETE USING (("uploaded_by" = "auth"."uid"()));



CREATE POLICY "Users can manage their own documents" ON "public"."seller_documents" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own payment methods" ON "public"."customer_payment_methods" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own saved searches" ON "public"."saved_searches" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own checkout sessions" ON "public"."checkout_sessions" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own notes" ON "public"."order_notes" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own pending applications" ON "public"."seller_applications" FOR UPDATE USING ((("auth"."uid"() = "user_id") AND (("status")::"text" = ANY ((ARRAY['pending'::character varying, 'info_requested'::character varying])::"text"[]))));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view order notes for their orders" ON "public"."order_notes" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM (("public"."orders" "o"
     JOIN "public"."order_items" "oi" ON (("o"."id" = "oi"."order_id")))
     JOIN "public"."listings" "l" ON (("oi"."listing_id" = "l"."id")))
  WHERE (("o"."id" = "order_notes"."order_id") AND (("l"."seller_id" = "auth"."uid"()) OR ("o"."buyer_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))));



CREATE POLICY "Users can view own checkout sessions" ON "public"."checkout_sessions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own refund requests" ON "public"."refund_requests" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view photos for their order items" ON "public"."order_item_photos" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM (("public"."order_items" "oi"
     JOIN "public"."listings" "l" ON (("oi"."listing_id" = "l"."id")))
     JOIN "public"."orders" "o" ON (("oi"."order_id" = "o"."id")))
  WHERE (("oi"."id" = "order_item_photos"."order_item_id") AND (("l"."seller_id" = "auth"."uid"()) OR ("o"."buyer_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))));



CREATE POLICY "Users can view their own applications" ON "public"."seller_applications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own payment intents" ON "public"."payment_intents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."id" = "payment_intents"."order_id") AND ("orders"."buyer_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (( SELECT ("auth"."uid"() = "profiles"."id")));



ALTER TABLE "public"."admin_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cart_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checkout_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."critical_payment_errors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_payment_methods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deleted_accounts_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fraud_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."helcim_transaction_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."listing_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."listing_views" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."listings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_item_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_intents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payout_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payout_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."price_alert_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."price_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."refund_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saved_searches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scryfall_import_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."seller_applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."seller_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."seller_payouts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."seller_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."seller_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shared_wishlists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wishlist_activity_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wishlists" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."cart_items";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "supabase_auth_admin";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."add_price_history_on_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_price_history_on_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_price_history_on_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_oracle_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."assign_oracle_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_oracle_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_card_market_price"("card_id_param" "uuid", "days_back" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_card_market_price"("card_id_param" "uuid", "days_back" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_card_market_price"("card_id_param" "uuid", "days_back" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_market_price"("card_id_param" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_market_price"("card_id_param" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_market_price"("card_id_param" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_seller_earnings"("seller_id" "uuid", "start_date" "date", "end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_seller_earnings"("seller_id" "uuid", "start_date" "date", "end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_seller_earnings"("seller_id" "uuid", "start_date" "date", "end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_seller_payout"("p_seller_id" "uuid", "p_order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_seller_payout"("p_seller_id" "uuid", "p_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_seller_payout"("p_seller_id" "uuid", "p_order_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_price_alerts_on_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_price_alerts_on_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_price_alerts_on_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_deleted_user_data"("deleted_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_deleted_user_data"("deleted_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_deleted_user_data"("deleted_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_checkout_sessions"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_checkout_sessions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_checkout_sessions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_shared_wishlists"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_shared_wishlists"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_shared_wishlists"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_saved_searches"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_saved_searches"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_saved_searches"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_security_logs"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_security_logs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_security_logs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."decrease_listing_quantity"("listing_id" "uuid", "quantity_sold" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."decrease_listing_quantity"("listing_id" "uuid", "quantity_sold" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrease_listing_quantity"("listing_id" "uuid", "quantity_sold" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_listing_quantity"("listing_id" "uuid", "quantity_to_subtract" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_listing_quantity"("listing_id" "uuid", "quantity_to_subtract" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_listing_quantity"("listing_id" "uuid", "quantity_to_subtract" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_card_price_trend"("card_id_param" "uuid", "days_back" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_card_price_trend"("card_id_param" "uuid", "days_back" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_card_price_trend"("card_id_param" "uuid", "days_back" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_search_suggestions"("search_term" "text", "suggestion_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_search_suggestions"("search_term" "text", "suggestion_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_search_suggestions"("search_term" "text", "suggestion_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_seller_dashboard_stats"("p_seller_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_seller_dashboard_stats"("p_seller_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_seller_dashboard_stats"("p_seller_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_seller_order_analytics"("p_seller_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_seller_order_analytics"("p_seller_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_seller_order_analytics"("p_seller_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_btree_consistent"("internal", smallint, "anyelement", integer, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_btree_consistent"("internal", smallint, "anyelement", integer, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_btree_consistent"("internal", smallint, "anyelement", integer, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_btree_consistent"("internal", smallint, "anyelement", integer, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_anyenum"("anyenum", "anyenum", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_anyenum"("anyenum", "anyenum", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_anyenum"("anyenum", "anyenum", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_anyenum"("anyenum", "anyenum", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bit"(bit, bit, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bit"(bit, bit, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bit"(bit, bit, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bit"(bit, bit, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bool"(boolean, boolean, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bool"(boolean, boolean, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bool"(boolean, boolean, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bool"(boolean, boolean, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bpchar"(character, character, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bpchar"(character, character, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bpchar"(character, character, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bpchar"(character, character, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bytea"("bytea", "bytea", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bytea"("bytea", "bytea", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bytea"("bytea", "bytea", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bytea"("bytea", "bytea", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_char"("char", "char", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_char"("char", "char", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_char"("char", "char", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_char"("char", "char", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_cidr"("cidr", "cidr", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_cidr"("cidr", "cidr", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_cidr"("cidr", "cidr", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_cidr"("cidr", "cidr", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_date"("date", "date", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_date"("date", "date", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_date"("date", "date", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_date"("date", "date", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_float4"(real, real, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_float4"(real, real, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_float4"(real, real, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_float4"(real, real, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_float8"(double precision, double precision, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_float8"(double precision, double precision, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_float8"(double precision, double precision, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_float8"(double precision, double precision, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_inet"("inet", "inet", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_inet"("inet", "inet", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_inet"("inet", "inet", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_inet"("inet", "inet", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int2"(smallint, smallint, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int2"(smallint, smallint, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int2"(smallint, smallint, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int2"(smallint, smallint, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int4"(integer, integer, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int4"(integer, integer, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int4"(integer, integer, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int4"(integer, integer, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int8"(bigint, bigint, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int8"(bigint, bigint, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int8"(bigint, bigint, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int8"(bigint, bigint, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_interval"(interval, interval, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_interval"(interval, interval, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_interval"(interval, interval, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_interval"(interval, interval, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_macaddr"("macaddr", "macaddr", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_macaddr"("macaddr", "macaddr", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_macaddr"("macaddr", "macaddr", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_macaddr"("macaddr", "macaddr", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_macaddr8"("macaddr8", "macaddr8", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_macaddr8"("macaddr8", "macaddr8", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_macaddr8"("macaddr8", "macaddr8", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_macaddr8"("macaddr8", "macaddr8", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_money"("money", "money", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_money"("money", "money", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_money"("money", "money", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_money"("money", "money", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_name"("name", "name", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_name"("name", "name", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_name"("name", "name", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_name"("name", "name", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_numeric"(numeric, numeric, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_numeric"(numeric, numeric, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_numeric"(numeric, numeric, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_numeric"(numeric, numeric, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_oid"("oid", "oid", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_oid"("oid", "oid", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_oid"("oid", "oid", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_oid"("oid", "oid", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_text"("text", "text", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_text"("text", "text", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_text"("text", "text", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_text"("text", "text", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_time"(time without time zone, time without time zone, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_time"(time without time zone, time without time zone, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_time"(time without time zone, time without time zone, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_time"(time without time zone, time without time zone, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timestamp"(timestamp without time zone, timestamp without time zone, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timestamp"(timestamp without time zone, timestamp without time zone, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timestamp"(timestamp without time zone, timestamp without time zone, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timestamp"(timestamp without time zone, timestamp without time zone, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timestamptz"(timestamp with time zone, timestamp with time zone, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timestamptz"(timestamp with time zone, timestamp with time zone, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timestamptz"(timestamp with time zone, timestamp with time zone, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timestamptz"(timestamp with time zone, timestamp with time zone, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timetz"(time with time zone, time with time zone, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timetz"(time with time zone, time with time zone, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timetz"(time with time zone, time with time zone, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timetz"(time with time zone, time with time zone, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_uuid"("uuid", "uuid", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_uuid"("uuid", "uuid", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_uuid"("uuid", "uuid", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_uuid"("uuid", "uuid", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_varbit"(bit varying, bit varying, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_varbit"(bit varying, bit varying, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_varbit"(bit varying, bit varying, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_varbit"(bit varying, bit varying, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_enum_cmp"("anyenum", "anyenum") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_enum_cmp"("anyenum", "anyenum") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_enum_cmp"("anyenum", "anyenum") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_enum_cmp"("anyenum", "anyenum") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_anyenum"("anyenum", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_anyenum"("anyenum", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_anyenum"("anyenum", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_anyenum"("anyenum", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_bit"(bit, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bit"(bit, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bit"(bit, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bit"(bit, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_bool"(boolean, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bool"(boolean, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bool"(boolean, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bool"(boolean, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_bpchar"(character, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bpchar"(character, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bpchar"(character, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bpchar"(character, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_bytea"("bytea", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bytea"("bytea", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bytea"("bytea", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bytea"("bytea", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_char"("char", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_char"("char", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_char"("char", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_char"("char", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_cidr"("cidr", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_cidr"("cidr", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_cidr"("cidr", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_cidr"("cidr", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_date"("date", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_date"("date", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_date"("date", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_date"("date", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_float4"(real, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_float4"(real, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_float4"(real, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_float4"(real, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_float8"(double precision, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_float8"(double precision, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_float8"(double precision, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_float8"(double precision, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_inet"("inet", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_inet"("inet", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_inet"("inet", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_inet"("inet", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_int2"(smallint, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int2"(smallint, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int2"(smallint, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int2"(smallint, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_int4"(integer, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int4"(integer, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int4"(integer, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int4"(integer, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_int8"(bigint, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int8"(bigint, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int8"(bigint, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int8"(bigint, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_interval"(interval, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_interval"(interval, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_interval"(interval, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_interval"(interval, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_macaddr"("macaddr", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_macaddr"("macaddr", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_macaddr"("macaddr", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_macaddr"("macaddr", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_macaddr8"("macaddr8", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_macaddr8"("macaddr8", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_macaddr8"("macaddr8", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_macaddr8"("macaddr8", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_money"("money", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_money"("money", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_money"("money", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_money"("money", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_name"("name", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_name"("name", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_name"("name", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_name"("name", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_numeric"(numeric, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_numeric"(numeric, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_numeric"(numeric, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_numeric"(numeric, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_oid"("oid", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_oid"("oid", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_oid"("oid", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_oid"("oid", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_text"("text", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_text"("text", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_text"("text", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_text"("text", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_time"(time without time zone, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_time"(time without time zone, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_time"(time without time zone, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_time"(time without time zone, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_timestamp"(timestamp without time zone, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timestamp"(timestamp without time zone, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timestamp"(timestamp without time zone, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timestamp"(timestamp without time zone, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_timestamptz"(timestamp with time zone, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timestamptz"(timestamp with time zone, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timestamptz"(timestamp with time zone, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timestamptz"(timestamp with time zone, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_timetz"(time with time zone, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timetz"(time with time zone, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timetz"(time with time zone, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timetz"(time with time zone, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_uuid"("uuid", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_uuid"("uuid", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_uuid"("uuid", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_uuid"("uuid", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_varbit"(bit varying, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_varbit"(bit varying, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_varbit"(bit varying, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_varbit"(bit varying, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_anyenum"("anyenum", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_anyenum"("anyenum", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_anyenum"("anyenum", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_anyenum"("anyenum", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_bit"(bit, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bit"(bit, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bit"(bit, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bit"(bit, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_bool"(boolean, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bool"(boolean, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bool"(boolean, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bool"(boolean, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_bpchar"(character, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bpchar"(character, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bpchar"(character, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bpchar"(character, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_bytea"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bytea"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bytea"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bytea"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_char"("char", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_char"("char", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_char"("char", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_char"("char", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_cidr"("cidr", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_cidr"("cidr", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_cidr"("cidr", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_cidr"("cidr", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_date"("date", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_date"("date", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_date"("date", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_date"("date", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_float4"(real, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_float4"(real, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_float4"(real, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_float4"(real, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_float8"(double precision, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_float8"(double precision, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_float8"(double precision, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_float8"(double precision, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_inet"("inet", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_inet"("inet", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_inet"("inet", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_inet"("inet", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_int2"(smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int2"(smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int2"(smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int2"(smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_int4"(integer, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int4"(integer, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int4"(integer, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int4"(integer, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_int8"(bigint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int8"(bigint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int8"(bigint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int8"(bigint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_interval"(interval, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_interval"(interval, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_interval"(interval, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_interval"(interval, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_macaddr"("macaddr", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_macaddr"("macaddr", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_macaddr"("macaddr", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_macaddr"("macaddr", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_macaddr8"("macaddr8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_macaddr8"("macaddr8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_macaddr8"("macaddr8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_macaddr8"("macaddr8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_money"("money", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_money"("money", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_money"("money", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_money"("money", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_name"("name", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_name"("name", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_name"("name", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_name"("name", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_numeric"(numeric, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_numeric"(numeric, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_numeric"(numeric, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_numeric"(numeric, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_oid"("oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_oid"("oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_oid"("oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_oid"("oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_text"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_text"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_text"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_text"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_time"(time without time zone, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_time"(time without time zone, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_time"(time without time zone, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_time"(time without time zone, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_timestamp"(timestamp without time zone, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timestamp"(timestamp without time zone, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timestamp"(timestamp without time zone, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timestamp"(timestamp without time zone, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_timestamptz"(timestamp with time zone, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timestamptz"(timestamp with time zone, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timestamptz"(timestamp with time zone, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timestamptz"(timestamp with time zone, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_timetz"(time with time zone, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timetz"(time with time zone, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timetz"(time with time zone, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timetz"(time with time zone, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_uuid"("uuid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_uuid"("uuid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_uuid"("uuid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_uuid"("uuid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_varbit"(bit varying, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_varbit"(bit varying, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_varbit"(bit varying, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_varbit"(bit varying, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_numeric_cmp"(numeric, numeric) TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_numeric_cmp"(numeric, numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."gin_numeric_cmp"(numeric, numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_numeric_cmp"(numeric, numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_listing_view_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_listing_view_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_listing_view_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_listing_views"("listing_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_listing_views"("listing_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_listing_views"("listing_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."min"("uuid", "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."min"("uuid", "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."min"("uuid", "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_order_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_order_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_order_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_price_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."record_price_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_price_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reduce_listing_quantity"("listing_id" "uuid", "p_reduce_quantity" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."reduce_listing_quantity"("listing_id" "uuid", "p_reduce_quantity" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reduce_listing_quantity"("listing_id" "uuid", "p_reduce_quantity" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_market_price_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_market_price_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_market_price_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_market_price_stats_full"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_market_price_stats_full"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_market_price_stats_full"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_market_price_stats_view"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_market_price_stats_view"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_market_price_stats_view"() TO "service_role";



GRANT ALL ON FUNCTION "public"."search_cards_ranked"("search_query" "text", "result_limit" integer, "result_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_cards_ranked"("search_query" "text", "result_limit" integer, "result_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_cards_ranked"("search_query" "text", "result_limit" integer, "result_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_order_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_order_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_order_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_card_with_scryfall"("card_id_param" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sync_card_with_scryfall"("card_id_param" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_card_with_scryfall"("card_id_param" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_update_market_price"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_update_market_price"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_update_market_price"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_update_payment_analytics"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_update_payment_analytics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_update_payment_analytics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_all_market_prices"("batch_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_all_market_prices"("batch_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_all_market_prices"("batch_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_card_search_vector"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_card_search_vector"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_card_search_vector"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_checkout_sessions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_checkout_sessions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_checkout_sessions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_listing_sales_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_listing_sales_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_listing_sales_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_listing_status_to_sold"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_listing_status_to_sold"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_listing_status_to_sold"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_market_price"("card_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_market_price"("card_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_market_price"("card_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_market_price_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_market_price_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_market_price_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_market_prices"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_market_prices"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_market_prices"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_payment_analytics"("target_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."update_payment_analytics"("target_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_payment_analytics"("target_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_seller_rating"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_seller_rating"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_seller_rating"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";












GRANT ALL ON FUNCTION "public"."min"("uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."min"("uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."min"("uuid") TO "service_role";









GRANT ALL ON TABLE "public"."admin_actions" TO "anon";
GRANT ALL ON TABLE "public"."admin_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_actions" TO "service_role";



GRANT ALL ON TABLE "public"."auth_logs" TO "anon";
GRANT ALL ON TABLE "public"."auth_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_logs" TO "service_role";



GRANT ALL ON TABLE "public"."cards" TO "anon";
GRANT ALL ON TABLE "public"."cards" TO "authenticated";
GRANT ALL ON TABLE "public"."cards" TO "service_role";



GRANT ALL ON TABLE "public"."listings" TO "anon";
GRANT ALL ON TABLE "public"."listings" TO "authenticated";
GRANT ALL ON TABLE "public"."listings" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."cards_needing_price_updates" TO "anon";
GRANT ALL ON TABLE "public"."cards_needing_price_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."cards_needing_price_updates" TO "service_role";



GRANT ALL ON TABLE "public"."cards_search_view" TO "anon";
GRANT ALL ON TABLE "public"."cards_search_view" TO "authenticated";
GRANT ALL ON TABLE "public"."cards_search_view" TO "service_role";



GRANT ALL ON TABLE "public"."cart_items" TO "anon";
GRANT ALL ON TABLE "public"."cart_items" TO "authenticated";
GRANT ALL ON TABLE "public"."cart_items" TO "service_role";



GRANT ALL ON TABLE "public"."checkout_sessions" TO "anon";
GRANT ALL ON TABLE "public"."checkout_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."checkout_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."critical_payment_errors" TO "anon";
GRANT ALL ON TABLE "public"."critical_payment_errors" TO "authenticated";
GRANT ALL ON TABLE "public"."critical_payment_errors" TO "service_role";



GRANT ALL ON TABLE "public"."customer_payment_methods" TO "anon";
GRANT ALL ON TABLE "public"."customer_payment_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_payment_methods" TO "service_role";



GRANT ALL ON TABLE "public"."price_history" TO "anon";
GRANT ALL ON TABLE "public"."price_history" TO "authenticated";
GRANT ALL ON TABLE "public"."price_history" TO "service_role";



GRANT ALL ON TABLE "public"."daily_price_changes" TO "anon";
GRANT ALL ON TABLE "public"."daily_price_changes" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_price_changes" TO "service_role";



GRANT ALL ON TABLE "public"."deleted_accounts_log" TO "anon";
GRANT ALL ON TABLE "public"."deleted_accounts_log" TO "authenticated";
GRANT ALL ON TABLE "public"."deleted_accounts_log" TO "service_role";



GRANT ALL ON TABLE "public"."fraud_alerts" TO "anon";
GRANT ALL ON TABLE "public"."fraud_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."fraud_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."helcim_transaction_logs" TO "anon";
GRANT ALL ON TABLE "public"."helcim_transaction_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."helcim_transaction_logs" TO "service_role";



GRANT ALL ON TABLE "public"."listing_analytics" TO "anon";
GRANT ALL ON TABLE "public"."listing_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."listing_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."listing_views" TO "anon";
GRANT ALL ON TABLE "public"."listing_views" TO "authenticated";
GRANT ALL ON TABLE "public"."listing_views" TO "service_role";



GRANT ALL ON TABLE "public"."market_price_analytics" TO "anon";
GRANT ALL ON TABLE "public"."market_price_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."market_price_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."market_price_stats" TO "anon";
GRANT ALL ON TABLE "public"."market_price_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."market_price_stats" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."order_item_photos" TO "anon";
GRANT ALL ON TABLE "public"."order_item_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."order_item_photos" TO "service_role";



GRANT ALL ON TABLE "public"."order_notes" TO "anon";
GRANT ALL ON TABLE "public"."order_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."order_notes" TO "service_role";



GRANT ALL ON TABLE "public"."payment_analytics" TO "anon";
GRANT ALL ON TABLE "public"."payment_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."payment_intents" TO "anon";
GRANT ALL ON TABLE "public"."payment_intents" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_intents" TO "service_role";



GRANT ALL ON TABLE "public"."payment_logs" TO "anon";
GRANT ALL ON TABLE "public"."payment_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_logs" TO "service_role";



GRANT ALL ON TABLE "public"."payout_schedules" TO "anon";
GRANT ALL ON TABLE "public"."payout_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."payout_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."payout_settings" TO "anon";
GRANT ALL ON TABLE "public"."payout_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."payout_settings" TO "service_role";



GRANT ALL ON TABLE "public"."platform_settings" TO "anon";
GRANT ALL ON TABLE "public"."platform_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_settings" TO "service_role";



GRANT ALL ON TABLE "public"."price_alert_notifications" TO "anon";
GRANT ALL ON TABLE "public"."price_alert_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."price_alert_notifications" TO "service_role";



GRANT ALL ON SEQUENCE "public"."price_history_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."price_history_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."price_history_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."profiles" TO "supabase_auth_admin";



GRANT ALL ON TABLE "public"."refund_requests" TO "anon";
GRANT ALL ON TABLE "public"."refund_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."refund_requests" TO "service_role";



GRANT ALL ON TABLE "public"."saved_searches" TO "anon";
GRANT ALL ON TABLE "public"."saved_searches" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_searches" TO "service_role";



GRANT ALL ON TABLE "public"."scryfall_import_jobs" TO "anon";
GRANT ALL ON TABLE "public"."scryfall_import_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."scryfall_import_jobs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."scryfall_import_jobs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."scryfall_import_jobs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."scryfall_import_jobs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."searchable_listings" TO "anon";
GRANT ALL ON TABLE "public"."searchable_listings" TO "authenticated";
GRANT ALL ON TABLE "public"."searchable_listings" TO "service_role";



GRANT ALL ON TABLE "public"."security_logs" TO "anon";
GRANT ALL ON TABLE "public"."security_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."security_logs" TO "service_role";



GRANT ALL ON TABLE "public"."seller_analytics" TO "anon";
GRANT ALL ON TABLE "public"."seller_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."seller_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."seller_applications" TO "anon";
GRANT ALL ON TABLE "public"."seller_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."seller_applications" TO "service_role";



GRANT ALL ON TABLE "public"."seller_documents" TO "anon";
GRANT ALL ON TABLE "public"."seller_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."seller_documents" TO "service_role";



GRANT ALL ON TABLE "public"."seller_order_summary" TO "anon";
GRANT ALL ON TABLE "public"."seller_order_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."seller_order_summary" TO "service_role";



GRANT ALL ON TABLE "public"."seller_payouts" TO "anon";
GRANT ALL ON TABLE "public"."seller_payouts" TO "authenticated";
GRANT ALL ON TABLE "public"."seller_payouts" TO "service_role";



GRANT ALL ON TABLE "public"."seller_reviews" TO "anon";
GRANT ALL ON TABLE "public"."seller_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."seller_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."seller_settings" TO "anon";
GRANT ALL ON TABLE "public"."seller_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."seller_settings" TO "service_role";



GRANT ALL ON TABLE "public"."shared_wishlists" TO "anon";
GRANT ALL ON TABLE "public"."shared_wishlists" TO "authenticated";
GRANT ALL ON TABLE "public"."shared_wishlists" TO "service_role";



GRANT ALL ON TABLE "public"."system_settings" TO "anon";
GRANT ALL ON TABLE "public"."system_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."system_settings" TO "service_role";



GRANT ALL ON TABLE "public"."wishlist_activity_log" TO "anon";
GRANT ALL ON TABLE "public"."wishlist_activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."wishlist_activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."wishlists" TO "anon";
GRANT ALL ON TABLE "public"."wishlists" TO "authenticated";
GRANT ALL ON TABLE "public"."wishlists" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























