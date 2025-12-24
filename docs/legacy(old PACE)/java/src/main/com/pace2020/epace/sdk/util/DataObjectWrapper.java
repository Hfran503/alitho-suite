package com.pace2020.epace.sdk.util;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

/**
 * @author <a href="mailto:faizanr@efi.com">faizan raza</a>
 */
public class DataObjectWrapper
{
    private static String PKEY_NAME = "primaryKey";
    private static SimpleDateFormat DATE_FORMAT = new SimpleDateFormat( "yyyy/MM/dd HH:mm" );

    private Map<String, String> pkeyMap = new HashMap<String, String>();
    private Map<String, String> attrMap = new HashMap<String, String>();

    private Object dataObject;

    public DataObjectWrapper( Object dataObject )
    {
        this.dataObject = dataObject;
    }

    public DataObjectWrapper( String type, String pkeyValue, Map<String, String> attrs ) throws ClassNotFoundException,
        NoSuchMethodException, InstantiationException, IllegalAccessException, InvocationTargetException,
        NoSuchFieldException, ParseException
    {
        if( null != pkeyValue && pkeyValue.length() > 0 )
        {
            pkeyMap.put( PKEY_NAME, pkeyValue );
        }
        if( null != attrs )
        {
            attrMap = attrs;
        }

        createLocalObject( Class.forName( "com.pace2020.epace.object." + type ) );
    }

    public DataObjectWrapper( String type, Map<String, String> pKeys, Map<String, String> attrs )
        throws ClassNotFoundException, NoSuchMethodException, InstantiationException, IllegalAccessException,
        InvocationTargetException, NoSuchFieldException, ParseException
    {
        if( null != pKeys )
        {
            pkeyMap = pKeys;
        }
        if( null != attrs )
        {
            attrMap = attrs;
        }

        createLocalObject( Class.forName( "com.pace2020.epace.object." + type ) );
    }

    private void createLocalObject( final Class clazz )
        throws NoSuchMethodException, InstantiationException, IllegalAccessException,
        InvocationTargetException, NoSuchFieldException, ParseException
    {
        final Constructor defaultConstructor = clazz.getConstructor();
        dataObject = defaultConstructor.newInstance();

        for( final String pkey : pkeyMap.keySet() )
        {
            final String pkeyValue = pkeyMap.get( pkey );
            if( null != pkeyValue && pkeyValue.length() > 0 )
            {
                final Field field = clazz.getDeclaredField( pkey );
                final Method setter = getSetter( clazz, field );
                setter.invoke( dataObject, getFieldValue( field, pkeyMap.get( pkey ) ) );
            }
        }
    }

    public void updateLocalObject() throws NoSuchFieldException, NoSuchMethodException, IllegalAccessException,
        InvocationTargetException, InstantiationException, ParseException
    {
        final Class clazz = getDataObjectClass();

        if( null != clazz && null != attrMap )
        {
            for( final String attr : attrMap.keySet() )
            {
                final Field field = clazz.getDeclaredField( attr );

                final Method setter = getSetter( clazz, field );
                setter.invoke( dataObject, getFieldValue( field, attrMap.get( attr ) ) );
            }
        }
    }

    public void print() throws NoSuchMethodException, NoSuchFieldException, IllegalAccessException,
        InvocationTargetException
    {
        if( null != dataObject )
        {
            final Class clazz = getDataObjectClass();

            System.out.println( getObjectType() + "[" + getPkeyValue() + "]" );
            for( final String attr : attrMap.keySet() )
            {
                final Method getter = getGetter( clazz, clazz.getDeclaredField( attr ) );
                final Object value = getter.invoke( dataObject );

                System.out.println( attr + "=" + value );
            }
        }
    }

    public String getPkeyValue() throws IllegalAccessException, InvocationTargetException, NoSuchMethodException,
        NoSuchFieldException
    {
        final Class clazz = getDataObjectClass();

        final Object pkeyValue = getGetter( clazz, clazz.getDeclaredField( PKEY_NAME ) ).invoke( dataObject );

        if( null != pkeyValue )
        {
            return pkeyValue.toString();
        }
        else
        {
            StringBuilder pkeyPairs = new StringBuilder();
            Iterator<String> iter = pkeyMap.values().iterator();

            while( iter.hasNext() )
            {
                pkeyPairs.append( iter.next() );
                if( iter.hasNext() )
                {
                    pkeyPairs.append( ":" );
                }
            }
            return pkeyPairs.toString();
        }
    }

    public Class getDataObjectClass()
    {
        return ( null == dataObject ) ? null : dataObject.getClass();
    }

    public String getObjectType()
    {
        return ( null == dataObject ) ? null : dataObject.getClass().getSimpleName();
    }

    public Object getDataObject()
    {
        return dataObject;
    }

    public void setDataObject( Object object )
    {
        dataObject = object;
    }

    public Map<String, String> getPkeyMap()
    {
        return pkeyMap;
    }

    public Map<String, String> getAttrMap()
    {
        return attrMap;
    }


    public static Method getGetter( final Class clazz, final Field field ) throws NoSuchMethodException
    {
        final String attr = field.getName();

        final char firstChar = attr.charAt( 0 );
        final String methodPrefix = field.getType().equals( Boolean.class ) ? "is" : "get";
        final String methodName = Character.isLowerCase( firstChar ) ?
            methodPrefix + Character.toUpperCase( firstChar ) + attr.substring( 1 ) :
            methodPrefix + attr;

        return clazz.getMethod( methodName );
    }

    public static Method getSetter( final Class clazz, final Field field ) throws NoSuchMethodException
    {
        final String attr = field.getName();

        final char firstChar = attr.charAt( 0 );
        final String methodPrefix = "set";
        final String methodName = Character.isLowerCase( firstChar ) ?
            methodPrefix + Character.toUpperCase( firstChar ) + attr.substring( 1 ) :
            methodPrefix + attr;

        return clazz.getMethod( methodName, field.getType() );
    }

    public static Object getFieldValue( final Field field, final String strValue ) throws NoSuchMethodException,
        InstantiationException, IllegalAccessException, InvocationTargetException, ParseException
    {
        if( field.getType().equals( String.class ) )
        {
            return strValue;
        }
        else if( field.getType().equals( Calendar.class ) )
        {
            final Calendar cal = Calendar.getInstance();
            cal.setTime( DATE_FORMAT.parse( strValue ) );
            return cal;
        }
        else if( field.getType().equals( Date.class ) )
        {
            return DATE_FORMAT.parse( strValue );
        }
        else if( field.getType().equals( Boolean.class ) )
        {
            return new Boolean( strValue );
        }
        else if( field.getType().equals( Integer.class ) )
        {
            return new Integer( strValue );
        }
        else if( field.getType().equals( Long.class ) )
        {
            return new Long( strValue );
        }
        else if( field.getType().equals( Float.class ) )
        {
            return new Float( strValue );
        }
        else if( field.getType().equals( Double.class ) )
        {
            return new Double( strValue );
        }

        final Constructor constructor = field.getType().getDeclaredConstructor( field.getType() );
        return constructor.newInstance( strValue );
    }

    public static DataObjectWrapper create( String... args ) throws Exception
    {
        if( args.length < 2 )
        {
            throw new Exception( "Arguments: <type> <pkey=pkeyVal> <attr1=val1,attr2=val2,attr3=val3>" );
        }
        else
        {
            String type = args[0];

            String[] pkeys = args[1].split( "," );
            if( pkeys.length == 0 )
            {
                throw new Exception( "Please provide primary key map" );
            }
            Map<String, String> pkeyMap = new HashMap<String, String>();
            for( String pair : pkeys )
            {
                splitAttributePair( pair, pkeyMap );
            }

            Map<String, String> attrMap = new HashMap<String, String>();
            if( args.length > 2 )
            {
                String[] attrs = args[2].split( "," );
                for( String pair : attrs )
                {
                    splitAttributePair( pair, attrMap );
                }
            }

            return new DataObjectWrapper( type, pkeyMap, attrMap );
        }
    }

    private static void splitAttributePair( final String nameValuePair, final Map<String, String> fieldMap )
        throws Exception
    {
        String[] pair = nameValuePair.split( "=" );
        if( pair.length == 2 )
        {
            fieldMap.put( pair[0], pair[1] );
        }
        else
        {
            throw new Exception( "Invalid Attribute map - " + pair );
        }
    }
}
