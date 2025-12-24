package com.pace2020.epace.sdk.util;

/**
 * @author <a href="mailto:jerry.duval@efi.com">jerry duval</a>
 */
public class FieldDescriptor extends com.pace2020.appbox.services.rpc.FieldDescriptor
{
    public FieldDescriptor( final String name, final String xpath )
    {
        super();

        setName( name );
        setXpath( xpath );
    }
}